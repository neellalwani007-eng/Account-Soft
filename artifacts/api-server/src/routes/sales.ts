import { Router, type IRouter } from "express";
import db from "../lib/db.js";

const router: IRouter = Router();

function mapSale(s: any, items: any[] = []): object {
  return {
    id: s.id,
    firmId: s.firm_id,
    date: s.date,
    voucherNo: s.voucher_no,
    invoiceNo: s.invoice_no,
    partyName: s.party_name,
    partyAddress: s.party_address,
    partyGst: s.party_gst,
    partyPhone: s.party_phone,
    paymentMode: s.payment_mode,
    isGstInvoice: s.is_gst_invoice === 1,
    narration: s.narration,
    voucherKind: s.voucher_kind,
    subtotal: s.subtotal,
    totalCgst: s.total_cgst,
    totalSgst: s.total_sgst,
    totalIgst: s.total_igst,
    grandTotal: s.grand_total,
    paidAmount: s.paid_amount || 0,
    items: items.map((i: any) => ({
      id: i.id,
      description: i.description,
      hsnCode: i.hsn_code,
      qty: i.qty,
      unit: i.unit,
      rate: i.rate,
      amount: i.amount,
      gstRate: i.gst_rate,
      cgst: i.cgst,
      sgst: i.sgst,
      igst: i.igst,
    })),
    createdAt: s.created_at,
  };
}

function getNextSaleNumber(firmId: number, kind: string): string {
  const prefix = kind === "Sale" ? "SALE" : "PURCH";
  const count = (db.prepare(`SELECT COUNT(*) as cnt FROM sale_vouchers WHERE firm_id = ? AND voucher_kind = ?`).get(firmId, kind) as any)?.cnt || 0;
  return `${prefix}/${String(count + 1).padStart(3, "0")}`;
}

function buildSaleRoutes(kind: string) {
  const path = kind === "Sale" ? "/sales" : "/purchases";

  router.get(path, async (req, res): Promise<void> => {
    const firmId = parseInt(req.query.firmId as string, 10);
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const partyName = req.query.partyName as string;

    let query = `SELECT * FROM sale_vouchers WHERE firm_id = ? AND voucher_kind = ?`;
    const params: (number | string)[] = [firmId, kind];

    if (dateFrom) { query += " AND date >= ?"; params.push(dateFrom); }
    if (dateTo) { query += " AND date <= ?"; params.push(dateTo); }
    if (partyName) { query += " AND party_name LIKE ?"; params.push(`%${partyName}%`); }
    query += " ORDER BY date DESC, id DESC";

    const sales = db.prepare(query).all(...params);
    res.json(sales.map((s: any) => mapSale(s)));
  });

  router.post(path, async (req, res): Promise<void> => {
    const { firmId, date, invoiceNo, partyName, partyAddress, partyGst, partyPhone, paymentMode, isGstInvoice, narration, items } = req.body;

    if (!firmId || !date || !partyName || !items?.length) {
      res.status(400).json({ message: "firmId, date, partyName, items required" });
      return;
    }

    let subtotal = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;
    for (const item of items) {
      subtotal += item.amount;
      const gst = isGstInvoice ? (item.amount * (item.gstRate || 0)) / 100 : 0;
      totalCgst += gst / 2;
      totalSgst += gst / 2;
    }
    const grandTotal = subtotal + totalCgst + totalSgst + totalIgst;
    const voucherNo = getNextSaleNumber(firmId, kind);

    const result = db.prepare(
      `INSERT INTO sale_vouchers (firm_id, date, voucher_no, invoice_no, party_name, party_address, party_gst, party_phone, payment_mode, is_gst_invoice, narration, voucher_kind, subtotal, total_cgst, total_sgst, total_igst, grand_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(firmId, date, voucherNo, invoiceNo || null, partyName, partyAddress || null, partyGst || null, partyPhone || null, paymentMode || "Cash", isGstInvoice ? 1 : 0, narration || null, kind, subtotal, totalCgst, totalSgst, totalIgst, grandTotal);

    const saleId = result.lastInsertRowid as number;

    for (const item of items) {
      const gst = isGstInvoice ? (item.amount * (item.gstRate || 0)) / 100 : 0;
      db.prepare(
        `INSERT INTO sale_items (voucher_id, description, hsn_code, qty, unit, rate, amount, gst_rate, cgst, sgst, igst)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(saleId, item.description, item.hsnCode || null, item.qty, item.unit || "Nos", item.rate, item.amount, item.gstRate || 0, gst/2, gst/2, 0);
    }

    db.prepare("INSERT OR IGNORE INTO persons_list (firm_id, name) VALUES (?, ?)").run(firmId, partyName);

    const sale = db.prepare("SELECT * FROM sale_vouchers WHERE id = ?").get(saleId);
    const saleItems = db.prepare("SELECT * FROM sale_items WHERE voucher_id = ?").all(saleId);
    res.status(201).json(mapSale(sale, saleItems));
  });
}

buildSaleRoutes("Sale");
buildSaleRoutes("Purchase");

router.get("/sales/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const sale = db.prepare("SELECT * FROM sale_vouchers WHERE id = ?").get(id);
  if (!sale) { res.status(404).json({ message: "Sale not found" }); return; }
  const items = db.prepare("SELECT * FROM sale_items WHERE voucher_id = ?").all(id);
  res.json(mapSale(sale, items));
});

router.delete("/sales/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  db.prepare("DELETE FROM sale_vouchers WHERE id = ?").run(id);
  res.json({ message: "Sale deleted" });
});

export default router;
