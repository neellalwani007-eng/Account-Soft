import { Router, type IRouter } from "express";
import db from "../lib/db.js";

const router: IRouter = Router();

router.get("/ledgers", async (req, res): Promise<void> => {
  const firmId = parseInt(req.query.firmId as string, 10);
  const ledgers = db.prepare("SELECT * FROM ledger_list WHERE firm_id = ? ORDER BY name").all(firmId);
  res.json(ledgers.map((l: any) => ({ id: l.id, firmId: l.firm_id, name: l.name, groupName: l.group_name, openingBalance: l.opening_balance || 0 })));
});

router.post("/ledgers", async (req, res): Promise<void> => {
  const { firmId, name, groupName, openingBalance } = req.body;
  if (!firmId || !name || !groupName) {
    res.status(400).json({ message: "firmId, name, groupName required" });
    return;
  }
  const result = db.prepare(
    "INSERT OR IGNORE INTO ledger_list (firm_id, name, group_name, opening_balance) VALUES (?, ?, ?, ?)"
  ).run(firmId, name, groupName, openingBalance || 0);
  const id = result.lastInsertRowid;
  const ledger = db.prepare("SELECT * FROM ledger_list WHERE id = ?").get(id);
  res.status(201).json({ id: (ledger as any)?.id, firmId, name, groupName, openingBalance: openingBalance || 0 });
});

router.put("/ledgers/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { firmId, name, groupName, openingBalance } = req.body;
  db.prepare("UPDATE ledger_list SET name=?, group_name=?, opening_balance=? WHERE id=?").run(name, groupName, openingBalance || 0, id);
  res.json({ id, firmId, name, groupName, openingBalance: openingBalance || 0 });
});

router.delete("/ledgers/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  db.prepare("DELETE FROM ledger_list WHERE id=?").run(id);
  res.json({ message: "Ledger deleted" });
});

router.get("/ledgers/entries", async (req, res): Promise<void> => {
  const firmId = parseInt(req.query.firmId as string, 10);
  const ledgerName = req.query.ledgerName as string;
  const dateFrom = req.query.dateFrom as string;
  const dateTo = req.query.dateTo as string;

  if (!ledgerName) { res.status(400).json({ message: "ledgerName required" }); return; }

  let query = "SELECT * FROM ledger_entries WHERE firm_id = ? AND ledger_name = ?";
  const params: (number | string)[] = [firmId, ledgerName];

  if (dateFrom) { query += " AND date >= ?"; params.push(dateFrom); }
  if (dateTo) { query += " AND date <= ?"; params.push(dateTo); }
  query += " ORDER BY date ASC, id ASC";

  const entries = db.prepare(query).all(...params) as any[];

  let totalDr = 0, totalCr = 0;
  for (const e of entries) {
    if (e.side === "Dr") totalDr += e.amount;
    else totalCr += e.amount;
  }

  const firm = db.prepare("SELECT opening_balance FROM firms WHERE id = ?").get(firmId) as any;
  const ledgerRow = db.prepare("SELECT opening_balance FROM ledger_list WHERE firm_id = ? AND name = ?").get(firmId, ledgerName) as any;
  let openingBalance = 0;
  let openingBalanceSide = "Dr";

  if (ledgerName === "Cash Account" || ledgerName === "Bank Account") {
    openingBalance = firm?.opening_balance || 0;
    openingBalanceSide = openingBalance >= 0 ? "Dr" : "Cr";
    openingBalance = Math.abs(openingBalance);
  } else if (ledgerRow?.opening_balance) {
    openingBalance = Math.abs(ledgerRow.opening_balance);
    openingBalanceSide = ledgerRow.opening_balance >= 0 ? "Dr" : "Cr";
  }

  const netDr = totalDr + (openingBalanceSide === "Dr" ? openingBalance : 0);
  const netCr = totalCr + (openingBalanceSide === "Cr" ? openingBalance : 0);

  let closingBalance = Math.abs(netDr - netCr);
  const closingBalanceSide = netDr >= netCr ? "Dr" : "Cr";

  res.json({
    accountName: ledgerName,
    openingBalance,
    openingBalanceSide,
    entries: entries.map((e: any) => ({
      id: e.id,
      voucherId: e.voucher_id,
      date: e.date,
      ledgerName: e.ledger_name,
      contraAccount: e.contra_account,
      side: e.side,
      amount: e.amount,
      narration: e.narration,
      voucherType: e.voucher_type,
    })),
    closingBalance,
    closingBalanceSide,
    totalDr: netDr,
    totalCr: netCr,
  });
});

export default router;