import { Router } from "express";
import db from "../lib/db.js";

const router = Router();

router.get("/outstanding/receivables", (req, res) => {
  const firmId = parseInt(req.query.firmId as string, 10);
  const rows = db.prepare(`
    SELECT sv.id, sv.date, sv.voucher_no, sv.party_name, sv.grand_total, sv.payment_mode, sv.voucher_kind, sv.narration,
           COALESCE(sv.paid_amount, 0) as paid_amount,
           sv.grand_total - COALESCE(sv.paid_amount, 0) as balance
    FROM sale_vouchers sv
    WHERE sv.firm_id = ? AND sv.voucher_kind = 'Sale' AND sv.payment_mode = 'Credit'
      AND (sv.grand_total - COALESCE(sv.paid_amount, 0)) > 0.01
    ORDER BY sv.date ASC
  `).all(firmId) as any[];
  res.json(rows);
});

router.get("/outstanding/payables", (req, res) => {
  const firmId = parseInt(req.query.firmId as string, 10);
  const rows = db.prepare(`
    SELECT sv.id, sv.date, sv.voucher_no, sv.party_name, sv.grand_total, sv.payment_mode, sv.voucher_kind, sv.narration,
           COALESCE(sv.paid_amount, 0) as paid_amount,
           sv.grand_total - COALESCE(sv.paid_amount, 0) as balance
    FROM sale_vouchers sv
    WHERE sv.firm_id = ? AND sv.voucher_kind = 'Purchase' AND sv.payment_mode = 'Credit'
      AND (sv.grand_total - COALESCE(sv.paid_amount, 0)) > 0.01
    ORDER BY sv.date ASC
  `).all(firmId) as any[];
  res.json(rows);
});

router.post("/outstanding/payment", (req, res) => {
  const { voucherId, paidAmount } = req.body;
  const current = db.prepare("SELECT paid_amount, grand_total FROM sale_vouchers WHERE id = ?").get(voucherId) as any;
  if (!current) { res.status(404).json({ error: "Not found" }); return; }
  const newPaid = Math.min((current.paid_amount || 0) + paidAmount, current.grand_total);
  db.prepare("UPDATE sale_vouchers SET paid_amount = ? WHERE id = ?").run(newPaid, voucherId);
  res.json({ message: "Payment recorded", paidAmount: newPaid });
});

export default router;
