import { Router, type IRouter } from "express";
import db from "../lib/db.js";
import { getNextVoucherNumber, postLedgerEntries, getCashBalance } from "../lib/voucher-helpers.js";

const router: IRouter = Router();

router.get("/vouchers", async (req, res): Promise<void> => {
  const firmId = parseInt(req.query.firmId as string, 10);
  const dateFrom = req.query.dateFrom as string;
  const dateTo = req.query.dateTo as string;
  const voucherType = req.query.voucherType as string;
  const limit = parseInt((req.query.limit as string) || "50", 10);
  const offset = parseInt((req.query.offset as string) || "0", 10);

  let query = "SELECT * FROM vouchers WHERE firm_id = ? AND is_opening = 0";
  const params: (number | string)[] = [firmId];

  if (dateFrom) { query += " AND date >= ?"; params.push(dateFrom); }
  if (dateTo) { query += " AND date <= ?"; params.push(dateTo); }
  if (voucherType) { query += " AND voucher_type = ?"; params.push(voucherType); }

  const total = (db.prepare(query.replace("SELECT *", "SELECT COUNT(*) as cnt")).get(...params) as any)?.cnt || 0;

  query += " ORDER BY date DESC, id DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const vouchers = db.prepare(query).all(...params);
  res.json({ vouchers: vouchers.map(mapVoucher), total });
});

router.get("/particulars", async (req, res): Promise<void> => {
  const firmId = parseInt(req.query.firmId as string, 10);
  const rows = db.prepare("SELECT id, name FROM particulars_list WHERE firm_id = ? ORDER BY name LIMIT 100").all(firmId);
  res.json(rows);
});

router.post("/vouchers", async (req, res): Promise<void> => {
  const { firmId, date, voucherType, mode, particulars, person, ledgerName, drLedger, crLedger, amount, narration, isOpening, createdBy, password, chequeNo, bankName } = req.body;

  if (!firmId || !date || !voucherType || amount == null) {
    res.status(400).json({ message: "firmId, date, voucherType, amount required" });
    return;
  }

  const closedDay = db.prepare("SELECT id FROM closed_days WHERE firm_id = ? AND date = ?").get(firmId, date);
  if (closedDay) {
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'day_close_password'").get() as any;
    const correctPwd = setting?.value || "confirm";
    if (password !== correctPwd) {
      res.status(403).json({ message: "Day is closed. Password required." });
      return;
    }
  }

  const voucherNo = isOpening ? `OB/${date}` : getNextVoucherNumber(firmId, date);

  const result = db.prepare(
    `INSERT INTO vouchers (firm_id, date, voucher_no, voucher_type, mode, particulars, person, ledger_name, dr_ledger, cr_ledger, amount, narration, cheque_no, bank_name, is_opening, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(firmId, date, voucherNo, voucherType, mode || null, particulars || null, person || null, ledgerName || null, drLedger || null, crLedger || null, amount, narration || null, chequeNo || null, bankName || null, isOpening ? 1 : 0, createdBy || null);

  const voucherId = result.lastInsertRowid as number;

  if (!isOpening) {
    postLedgerEntries(voucherId, firmId, date, voucherType, particulars || "", person || "", drLedger, crLedger, amount, narration);

    if (particulars) {
      db.prepare("INSERT OR IGNORE INTO particulars_list (firm_id, name) VALUES (?, ?)").run(firmId, particulars);
    }
    if (ledgerName) {
      db.prepare("INSERT OR IGNORE INTO particulars_list (firm_id, name) VALUES (?, ?)").run(firmId, ledgerName);
    }
    if (person) {
      db.prepare("INSERT OR IGNORE INTO persons_list (firm_id, name) VALUES (?, ?)").run(firmId, person);
    }
  }

  const voucher = db.prepare("SELECT * FROM vouchers WHERE id = ?").get(voucherId);
  res.status(201).json(mapVoucher(voucher));
});

router.get("/vouchers/next-number", async (req, res): Promise<void> => {
  const firmId = parseInt(req.query.firmId as string, 10);
  const voucherNo = getNextVoucherNumber(firmId);
  res.json({ voucherNo });
});

router.get("/vouchers/cash-balance", async (req, res): Promise<void> => {
  const firmId = parseInt(req.query.firmId as string, 10);
  const asOfDate = req.query.asOfDate as string | undefined;
  const balance = getCashBalance(firmId, asOfDate);
  res.json({ balance });
});

router.get("/vouchers/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const voucher = db.prepare("SELECT * FROM vouchers WHERE id = ?").get(id);
  if (!voucher) { res.status(404).json({ message: "Voucher not found" }); return; }
  res.json(mapVoucher(voucher));
});

router.delete("/vouchers/delete-many", async (req, res): Promise<void> => {
  const { ids, firmId, password } = req.body;
  if (!ids?.length) { res.status(400).json({ message: "ids required" }); return; }

  const placeholders = ids.map(() => "?").join(",");
  const vouchers = db.prepare(`SELECT * FROM vouchers WHERE id IN (${placeholders})`).all(...ids) as any[];

  const closedDays = db.prepare("SELECT date FROM closed_days WHERE firm_id = ?").all(firmId).map((r: any) => r.date);
  const hasClosedDay = vouchers.some((v: any) => closedDays.includes(v.date));

  if (hasClosedDay) {
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'day_close_password'").get() as any;
    const correctPwd = setting?.value || "confirm";
    if (password !== correctPwd) {
      res.status(403).json({ message: "Password required for closed day entries" });
      return;
    }
  }

  db.prepare(`DELETE FROM vouchers WHERE id IN (${placeholders})`).run(...ids);
  res.json({ message: `${ids.length} vouchers deleted` });
});

router.delete("/vouchers/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { password } = req.body || {};

  const voucher = db.prepare("SELECT * FROM vouchers WHERE id = ?").get(id) as any;
  if (!voucher) { res.status(404).json({ message: "Voucher not found" }); return; }

  const closedDay = db.prepare("SELECT id FROM closed_days WHERE firm_id = ? AND date = ?").get(voucher.firm_id, voucher.date);
  if (closedDay) {
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'day_close_password'").get() as any;
    const correctPwd = setting?.value || "confirm";
    if (password !== correctPwd) {
      res.status(403).json({ message: "Day is closed. Password required." });
      return;
    }
  }

  db.prepare("DELETE FROM vouchers WHERE id = ?").run(id);
  res.json({ message: "Voucher deleted" });
});

router.get("/closed-days", async (req, res): Promise<void> => {
  const firmId = parseInt(req.query.firmId as string, 10);
  const days = db.prepare("SELECT date FROM closed_days WHERE firm_id = ? ORDER BY date").all(firmId).map((r: any) => r.date);
  res.json(days);
});

router.post("/closed-days", async (req, res): Promise<void> => {
  const { firmId, date } = req.body;
  db.prepare("INSERT OR IGNORE INTO closed_days (firm_id, date) VALUES (?, ?)").run(firmId, date);
  res.json({ message: "Day closed" });
});

router.post("/closed-days/verify-password", async (req, res): Promise<void> => {
  const { password } = req.body;
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'day_close_password'").get() as any;
  const correctPwd = setting?.value || "confirm";
  res.json({ valid: password === correctPwd });
});

function mapVoucher(v: any) {
  return {
    id: v.id,
    firmId: v.firm_id,
    date: v.date,
    voucherNo: v.voucher_no,
    voucherType: v.voucher_type,
    mode: v.mode,
    particulars: v.particulars,
    person: v.person,
    ledgerName: v.ledger_name,
    drLedger: v.dr_ledger,
    crLedger: v.cr_ledger,
    amount: v.amount,
    narration: v.narration,
    chequeNo: v.cheque_no,
    bankName: v.bank_name,
    chequeStatus: v.cheque_status,
    isOpening: v.is_opening === 1,
    createdAt: v.created_at,
    createdBy: v.created_by,
  };
}

export default router;
