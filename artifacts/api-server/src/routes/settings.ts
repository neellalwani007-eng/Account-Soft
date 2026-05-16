import { Router, type IRouter } from "express";
import db from "../lib/db.js";

const router: IRouter = Router();

router.get("/settings", async (_req, res): Promise<void> => {
  const rows = db.prepare("SELECT key, value FROM settings").all() as any[];
  const settings: Record<string, any> = {};
  for (const row of rows) {
    if (row.key === "auto_close_at_midnight") settings.autoCloseAtMidnight = row.value === "true";
    else if (row.key === "day_close_password") settings.dayClosePassword = row.value;
    else if (row.key === "default_payment_mode") settings.defaultPaymentMode = row.value;
    else if (row.key === "bill_prefix") settings.billPrefix = row.value;
    else if (row.key === "bill_language") settings.billLanguage = row.value;
    else if (row.key === "active_firm_id") settings.activeFirmId = row.value ? parseInt(row.value, 10) : undefined;
  }
  res.json(settings);
});

router.put("/settings", async (req, res): Promise<void> => {
  const { dayClosePassword, autoCloseAtMidnight, defaultPaymentMode, billPrefix, billLanguage, activeFirmId } = req.body;

  const update = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  if (dayClosePassword !== undefined) update.run("day_close_password", dayClosePassword);
  if (autoCloseAtMidnight !== undefined) update.run("auto_close_at_midnight", String(autoCloseAtMidnight));
  if (defaultPaymentMode !== undefined) update.run("default_payment_mode", defaultPaymentMode);
  if (billPrefix !== undefined) update.run("bill_prefix", billPrefix);
  if (billLanguage !== undefined) update.run("bill_language", billLanguage);
  if (activeFirmId !== undefined) update.run("active_firm_id", String(activeFirmId));

  const rows = db.prepare("SELECT key, value FROM settings").all() as any[];
  const settings: Record<string, any> = {};
  for (const row of rows) {
    if (row.key === "auto_close_at_midnight") settings.autoCloseAtMidnight = row.value === "true";
    else if (row.key === "day_close_password") settings.dayClosePassword = row.value;
    else if (row.key === "default_payment_mode") settings.defaultPaymentMode = row.value;
    else if (row.key === "bill_prefix") settings.billPrefix = row.value;
    else if (row.key === "bill_language") settings.billLanguage = row.value;
    else if (row.key === "active_firm_id") settings.activeFirmId = row.value ? parseInt(row.value, 10) : undefined;
  }
  res.json(settings);
});

router.get("/autocomplete/particulars", async (req, res): Promise<void> => {
  const firmId = parseInt(req.query.firmId as string, 10);
  const q = (req.query.q as string) || "";
  const rows = db.prepare(
    "SELECT name FROM particulars_list WHERE firm_id = ? AND name LIKE ? ORDER BY name LIMIT 20"
  ).all(firmId, `%${q}%`) as any[];
  res.json(rows.map((r) => r.name));
});

router.get("/autocomplete/persons", async (req, res): Promise<void> => {
  const firmId = parseInt(req.query.firmId as string, 10);
  const q = (req.query.q as string) || "";
  const rows = db.prepare(
    "SELECT name FROM persons_list WHERE firm_id = ? AND name LIKE ? ORDER BY name LIMIT 20"
  ).all(firmId, `%${q}%`) as any[];
  res.json(rows.map((r) => r.name));
});

router.post("/import/excel", async (req, res): Promise<void> => {
  const { firmId, rows } = req.body;
  if (!firmId || !rows?.length) { res.status(400).json({ message: "firmId and rows required" }); return; }

  let inserted = 0, skipped = 0;

  for (const row of rows) {
    const { date, voucherNo, voucherType, particulars, person, amount } = row;
    if (!date || !voucherType || amount == null) { skipped++; continue; }

    const existing = voucherNo
      ? db.prepare("SELECT id FROM vouchers WHERE firm_id = ? AND voucher_no = ?").get(firmId, voucherNo)
      : null;

    if (existing) { skipped++; continue; }

    const vNo = voucherNo || `IMP/${date}/${inserted + 1}`;
    db.prepare(
      `INSERT INTO vouchers (firm_id, date, voucher_no, voucher_type, particulars, person, amount, is_opening, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'import')`
    ).run(firmId, date, vNo, voucherType, particulars || null, person || null, amount);

    if (particulars) db.prepare("INSERT OR IGNORE INTO particulars_list (firm_id, name) VALUES (?, ?)").run(firmId, particulars);
    if (person) db.prepare("INSERT OR IGNORE INTO persons_list (firm_id, name) VALUES (?, ?)").run(firmId, person);

    inserted++;
  }

  res.json({ inserted, skipped, total: rows.length, message: `Imported ${inserted} records, skipped ${skipped} duplicates` });
});

export default router;
