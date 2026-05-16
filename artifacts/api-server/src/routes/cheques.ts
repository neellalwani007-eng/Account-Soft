import { Router } from "express";
import db from "../lib/db.js";

const router = Router();

router.get("/cheques", (req, res) => {
  const firmId = parseInt(req.query.firmId as string, 10);
  const rows = db.prepare(`
    SELECT v.id, v.date, v.voucher_no, v.voucher_type, v.amount, v.particulars, v.person,
           v.cheque_no, v.bank_name, v.cheque_status, v.narration
    FROM vouchers v
    WHERE v.firm_id = ? AND v.cheque_no IS NOT NULL AND v.cheque_no != ''
    ORDER BY v.date DESC
  `).all(firmId) as any[];
  res.json(rows.map(r => ({
    id: r.id, date: r.date, voucherNo: r.voucher_no, voucherType: r.voucher_type,
    amount: r.amount, particulars: r.particulars, person: r.person,
    chequeNo: r.cheque_no, bankName: r.bank_name, chequeStatus: r.cheque_status || "Issued", narration: r.narration,
  })));
});

router.put("/cheques/:id/status", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status } = req.body;
  db.prepare("UPDATE vouchers SET cheque_status = ? WHERE id = ?").run(status, id);
  res.json({ message: "Status updated" });
});

export default router;
