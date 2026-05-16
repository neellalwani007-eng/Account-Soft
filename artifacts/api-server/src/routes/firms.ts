import { Router, type IRouter } from "express";
import db from "../lib/db.js";

const router: IRouter = Router();

router.get("/firms", async (_req, res): Promise<void> => {
  const firms = db.prepare("SELECT * FROM firms ORDER BY name").all();
  res.json(firms.map(mapFirm));
});

router.post("/firms", async (req, res): Promise<void> => {
  const { name, address, gstNumber, phone, email, prefix, openingBalance, openingBalanceDate } = req.body;
  if (!name || !prefix) {
    res.status(400).json({ message: "name and prefix are required" });
    return;
  }
  const result = db.prepare(
    `INSERT INTO firms (name, address, gst_number, phone, email, prefix, opening_balance, opening_balance_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(name, address || null, gstNumber || null, phone || null, email || null, prefix, openingBalance || 0, openingBalanceDate || null);

  const firmId = result.lastInsertRowid as number;

  db.prepare("INSERT OR IGNORE INTO ledger_list (firm_id, name, group_name) VALUES (?, ?, ?)").run(firmId, "Cash Account", "Cash & Bank");
  db.prepare("INSERT OR IGNORE INTO ledger_list (firm_id, name, group_name) VALUES (?, ?, ?)").run(firmId, "Bank Account", "Cash & Bank");
  db.prepare("INSERT OR IGNORE INTO ledger_list (firm_id, name, group_name) VALUES (?, ?, ?)").run(firmId, "Sales Account", "Income");
  db.prepare("INSERT OR IGNORE INTO ledger_list (firm_id, name, group_name) VALUES (?, ?, ?)").run(firmId, "Purchase Account", "Expense");

  const firm = db.prepare("SELECT * FROM firms WHERE id = ?").get(firmId);
  res.status(201).json(mapFirm(firm));
});

router.get("/firms/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const firm = db.prepare("SELECT * FROM firms WHERE id = ?").get(id);
  if (!firm) { res.status(404).json({ message: "Firm not found" }); return; }
  res.json(mapFirm(firm));
});

router.put("/firms/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, address, gstNumber, phone, email, prefix, openingBalance, openingBalanceDate } = req.body;
  db.prepare(
    `UPDATE firms SET name=?, address=?, gst_number=?, phone=?, email=?, prefix=?, opening_balance=?, opening_balance_date=? WHERE id=?`
  ).run(name, address || null, gstNumber || null, phone || null, email || null, prefix, openingBalance || 0, openingBalanceDate || null, id);
  const firm = db.prepare("SELECT * FROM firms WHERE id = ?").get(id);
  if (!firm) { res.status(404).json({ message: "Firm not found" }); return; }
  res.json(mapFirm(firm));
});

router.delete("/firms/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  db.prepare("DELETE FROM firms WHERE id = ?").run(id);
  res.json({ message: "Firm deleted" });
});

function mapFirm(f: any) {
  return {
    id: f.id,
    name: f.name,
    address: f.address,
    gstNumber: f.gst_number,
    phone: f.phone,
    email: f.email,
    logoPath: f.logo_path,
    prefix: f.prefix,
    openingBalance: f.opening_balance,
    openingBalanceDate: f.opening_balance_date,
    createdAt: f.created_at,
  };
}

export default router;
