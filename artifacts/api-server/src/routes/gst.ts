import { Router } from "express";
import db from "../lib/db.js";

const router = Router();

router.get("/gst/summary", (req, res) => {
  const firmId = parseInt(req.query.firmId as string, 10);
  const month = req.query.month as string;
  const year = req.query.year as string;

  const dateFrom = `${year}-${month}-01`;
  const dateTo = `${year}-${month}-31`;

  const sales = db.prepare(`
    SELECT sv.date, sv.party_name, sv.party_gst, sv.voucher_no,
           si.description, si.hsn_code, si.qty, si.rate, si.amount,
           si.gst_rate, si.cgst, si.sgst, si.igst
    FROM sale_vouchers sv
    JOIN sale_items si ON si.voucher_id = sv.id
    WHERE sv.firm_id = ? AND sv.is_gst_invoice = 1 AND sv.voucher_kind = 'Sale'
      AND sv.date BETWEEN ? AND ?
    ORDER BY sv.date
  `).all(firmId, dateFrom, dateTo) as any[];

  const purchases = db.prepare(`
    SELECT sv.date, sv.party_name, sv.party_gst, sv.voucher_no,
           si.description, si.hsn_code, si.qty, si.rate, si.amount,
           si.gst_rate, si.cgst, si.sgst, si.igst
    FROM sale_vouchers sv
    JOIN sale_items si ON si.voucher_id = sv.id
    WHERE sv.firm_id = ? AND sv.is_gst_invoice = 1 AND sv.voucher_kind = 'Purchase'
      AND sv.date BETWEEN ? AND ?
    ORDER BY sv.date
  `).all(firmId, dateFrom, dateTo) as any[];

  const sum = (arr: any[], field: string) => arr.reduce((a, r) => a + (r[field] || 0), 0);

  const saleTotals = {
    taxable: sum(sales, "amount"),
    cgst: sum(sales, "cgst"),
    sgst: sum(sales, "sgst"),
    igst: sum(sales, "igst"),
  };
  const purchaseTotals = {
    taxable: sum(purchases, "amount"),
    cgst: sum(purchases, "cgst"),
    sgst: sum(purchases, "sgst"),
    igst: sum(purchases, "igst"),
  };
  const netPayable = {
    cgst: saleTotals.cgst - purchaseTotals.cgst,
    sgst: saleTotals.sgst - purchaseTotals.sgst,
    igst: saleTotals.igst - purchaseTotals.igst,
    total: (saleTotals.cgst + saleTotals.sgst + saleTotals.igst) - (purchaseTotals.cgst + purchaseTotals.sgst + purchaseTotals.igst),
  };

  res.json({ sales, purchases, saleTotals, purchaseTotals, netPayable });
});

router.get("/gst/trial-balance", (req, res) => {
  const firmId = parseInt(req.query.firmId as string, 10);

  const ledgers = db.prepare(`
    SELECT ledger_name, side, SUM(amount) as total
    FROM ledger_entries
    WHERE firm_id = ?
    GROUP BY ledger_name, side
    ORDER BY ledger_name
  `).all(firmId) as any[];

  const byName: Record<string, { dr: number; cr: number }> = {};
  for (const row of ledgers) {
    if (!byName[row.ledger_name]) byName[row.ledger_name] = { dr: 0, cr: 0 };
    if (row.side === "Dr") byName[row.ledger_name].dr += row.total;
    else byName[row.ledger_name].cr += row.total;
  }

  const result = Object.entries(byName).map(([name, { dr, cr }]) => ({
    name,
    drTotal: dr,
    crTotal: cr,
    balance: dr - cr,
    side: dr >= cr ? "Dr" : "Cr",
  }));

  const totals = result.reduce((a, r) => {
    a.dr += r.drTotal;
    a.cr += r.crTotal;
    return a;
  }, { dr: 0, cr: 0 });

  res.json({ accounts: result, totals });
});

export default router;
