import { Router, type IRouter } from "express";
import db from "../lib/db.js";
import { getCashBalance } from "../lib/voucher-helpers.js";

const router: IRouter = Router();

router.get("/reports/cash-book", async (req, res): Promise<void> => {
  const firmId = parseInt(req.query.firmId as string, 10);
  const dateFrom = req.query.dateFrom as string;
  const dateTo = req.query.dateTo as string;

  let query = `SELECT * FROM vouchers WHERE firm_id = ? AND is_opening = 0`;
  const params: (number | string)[] = [firmId];
  if (dateFrom) { query += " AND date >= ?"; params.push(dateFrom); }
  if (dateTo) { query += " AND date <= ?"; params.push(dateTo); }
  query += " ORDER BY date ASC, id ASC";

  const vouchers = db.prepare(query).all(...params) as any[];

  const dayMap = new Map<string, { receipts: any[]; payments: any[] }>();
  for (const v of vouchers) {
    if (!dayMap.has(v.date)) dayMap.set(v.date, { receipts: [], payments: [] });
    const isReceipt = ["Cash Receipt", "Bank Receipt", "Bank"].includes(v.voucher_type) ||
      (v.voucher_type === "Bank" && v.mode !== "payment");
    const isPayment = ["Cash Payment", "Bank Payment"].includes(v.voucher_type);
    if (isPayment) dayMap.get(v.date)!.payments.push(v);
    else dayMap.get(v.date)!.receipts.push(v);
  }

  const firm = db.prepare("SELECT opening_balance FROM firms WHERE id = ?").get(firmId) as any;
  let runningBalance = firm?.opening_balance || 0;

  const days = [];
  let totalReceipts = 0, totalPayments = 0;

  for (const [date, { receipts, payments }] of dayMap) {
    const dayReceipts = receipts.reduce((s: number, v: any) => s + v.amount, 0);
    const dayPayments = payments.reduce((s: number, v: any) => s + v.amount, 0);
    const openingBalance = runningBalance;
    runningBalance = openingBalance + dayReceipts - dayPayments;
    totalReceipts += dayReceipts;
    totalPayments += dayPayments;

    days.push({
      date,
      openingBalance,
      receipts: receipts.map(mapVoucher),
      payments: payments.map(mapVoucher),
      closingBalance: runningBalance,
      totalReceipts: dayReceipts,
      totalPayments: dayPayments,
    });
  }

  res.json({ days, totalReceipts, totalPayments, netFlow: totalReceipts - totalPayments });
});

router.get("/reports/day-book", async (req, res): Promise<void> => {
  const firmId = parseInt(req.query.firmId as string, 10);
  const dateFrom = req.query.dateFrom as string;
  const dateTo = req.query.dateTo as string;

  let query = `SELECT * FROM vouchers WHERE firm_id = ? AND is_opening = 0`;
  const params: (number | string)[] = [firmId];
  if (dateFrom) { query += " AND date >= ?"; params.push(dateFrom); }
  if (dateTo) { query += " AND date <= ?"; params.push(dateTo); }
  query += " ORDER BY date ASC, id ASC";

  const vouchers = db.prepare(query).all(...params) as any[];
  const firm = db.prepare("SELECT opening_balance FROM firms WHERE id = ?").get(firmId) as any;
  let runningBalance = firm?.opening_balance || 0;

  const entries = vouchers.map((v: any) => {
    const isPayment = ["Cash Payment", "Bank Payment"].includes(v.voucher_type);
    runningBalance = isPayment ? runningBalance - v.amount : runningBalance + v.amount;
    return {
      id: v.id,
      date: v.date,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      mode: v.mode,
      particulars: v.particulars,
      person: v.person,
      amount: v.amount,
      runningBalance,
    };
  });

  res.json(entries);
});

router.get("/reports/monthly-summary", async (req, res): Promise<void> => {
  const firmId = parseInt(req.query.firmId as string, 10);
  const fy = req.query.financialYear as string; // e.g. "25-26"

  const [y1, y2] = fy.split("-").map((s) => parseInt(`20${s}`, 10));
  const startDate = `${y1}-04-01`;
  const endDate = `${y2}-03-31`;

  const vouchers = db.prepare(
    `SELECT date, voucher_type, amount FROM vouchers WHERE firm_id = ? AND is_opening = 0 AND date >= ? AND date <= ? ORDER BY date`
  ).all(firmId, startDate, endDate) as any[];

  const monthMap = new Map<string, { receipts: number; payments: number }>();
  const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

  for (let i = 0; i < 12; i++) {
    const year = i < 9 ? y1 : y2;
    const monthIdx = i < 9 ? i + 3 : i - 9;
    const key = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
    monthMap.set(key, { receipts: 0, payments: 0 });
  }

  for (const v of vouchers) {
    const key = v.date.slice(0, 7);
    if (!monthMap.has(key)) continue;
    const isPayment = ["Cash Payment", "Bank Payment", "Purchase"].includes(v.voucher_type);
    if (isPayment) monthMap.get(key)!.payments += v.amount;
    else monthMap.get(key)!.receipts += v.amount;
  }

  let totalReceipts = 0, totalPayments = 0;
  const rows = [];
  let i = 0;
  for (const [key, { receipts, payments }] of monthMap) {
    const net = receipts - payments;
    totalReceipts += receipts;
    totalPayments += payments;
    rows.push({ month: months[i++], receipts, payments, net });
  }

  res.json({ rows, totalReceipts, totalPayments, totalNet: totalReceipts - totalPayments });
});

router.get("/reports/analysis", async (req, res): Promise<void> => {
  const firmId = parseInt(req.query.firmId as string, 10);
  const dateFrom = req.query.dateFrom as string;
  const dateTo = req.query.dateTo as string;

  let q = `SELECT * FROM vouchers WHERE firm_id = ? AND is_opening = 0`;
  const params: (number | string)[] = [firmId];
  if (dateFrom) { q += " AND date >= ?"; params.push(dateFrom); }
  if (dateTo) { q += " AND date <= ?"; params.push(dateTo); }

  const vouchers = db.prepare(q + " ORDER BY date").all(...params) as any[];

  let totalReceipts = 0, totalPayments = 0;
  const dailyMap = new Map<string, { receipts: number; payments: number }>();
  const monthlyMap = new Map<string, { receipts: number; payments: number }>();
  const expenseMap = new Map<string, number>();
  const receiptMap = new Map<string, number>();
  const receiptParties = new Map<string, number>();
  const paymentParties = new Map<string, number>();
  const modeMap = new Map<string, { count: number; amount: number }>();

  for (const v of vouchers) {
    const isPayment = ["Cash Payment", "Bank Payment", "Purchase"].includes(v.voucher_type);
    const day = v.date;
    const month = v.date.slice(0, 7);
    const mode = v.mode || (v.voucher_type.includes("Bank") ? "Bank" : "Cash");

    if (!dailyMap.has(day)) dailyMap.set(day, { receipts: 0, payments: 0 });
    if (!monthlyMap.has(month)) monthlyMap.set(month, { receipts: 0, payments: 0 });
    if (!modeMap.has(mode)) modeMap.set(mode, { count: 0, amount: 0 });
    modeMap.get(mode)!.count++;
    modeMap.get(mode)!.amount += v.amount;

    if (isPayment) {
      totalPayments += v.amount;
      dailyMap.get(day)!.payments += v.amount;
      monthlyMap.get(month)!.payments += v.amount;
      const cat = v.particulars || "Other";
      expenseMap.set(cat, (expenseMap.get(cat) || 0) + v.amount);
      if (v.person) paymentParties.set(v.person, (paymentParties.get(v.person) || 0) + v.amount);
    } else {
      totalReceipts += v.amount;
      dailyMap.get(day)!.receipts += v.amount;
      monthlyMap.get(month)!.receipts += v.amount;
      const cat = v.particulars || "Other";
      receiptMap.set(cat, (receiptMap.get(cat) || 0) + v.amount);
      if (v.person) receiptParties.set(v.person, (receiptParties.get(v.person) || 0) + v.amount);
    }
  }

  const toSorted = (m: Map<string, number>, limit = 8) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, amount]) => ({
      name,
      amount,
      percentage: totalPayments > 0 ? Math.round((amount / (name in [...expenseMap.keys()] ? totalPayments : totalReceipts)) * 100) : 0,
    }));

  const expenseBreakdown = [...expenseMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, amount]) => ({
    name, amount, percentage: totalPayments > 0 ? Math.round((amount / totalPayments) * 100) : 0,
  }));
  const receiptBreakdown = [...receiptMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, amount]) => ({
    name, amount, percentage: totalReceipts > 0 ? Math.round((amount / totalReceipts) * 100) : 0,
  }));

  const allFirms = db.prepare("SELECT id, name FROM firms").all() as any[];
  const firmComparisons = allFirms.map((f: any) => {
    const fv = db.prepare(`SELECT voucher_type, amount FROM vouchers WHERE firm_id = ? AND is_opening = 0`).all(f.id) as any[];
    let r = 0, p = 0;
    for (const v of fv) {
      if (["Cash Payment", "Bank Payment", "Purchase"].includes(v.voucher_type)) p += v.amount;
      else r += v.amount;
    }
    return { firmId: f.id, firmName: f.name, receipts: r, payments: p, balance: r - p };
  });

  res.json({
    totalReceipts,
    totalPayments,
    netCashFlow: totalReceipts - totalPayments,
    transactionCount: vouchers.length,
    dailyFlow: [...dailyMap.entries()].map(([date, v]) => ({ date, ...v })),
    monthlyTrends: [...monthlyMap.entries()].map(([month, v]) => ({ month, ...v, net: v.receipts - v.payments })),
    expenseBreakdown,
    receiptBreakdown,
    topReceiptParties: [...receiptParties.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, amount]) => ({ name, amount })),
    topPaymentParties: [...paymentParties.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, amount]) => ({ name, amount })),
    modeBreakdown: [...modeMap.entries()].map(([mode, v]) => ({ mode, ...v })),
    firmComparisons,
  });
});

router.get("/reports/ledger-search", async (req, res): Promise<void> => {
  const firmId = parseInt(req.query.firmId as string, 10);
  const query = req.query.query as string;
  const dateFrom = req.query.dateFrom as string;
  const dateTo = req.query.dateTo as string;

  let q = `SELECT * FROM vouchers WHERE firm_id = ? AND is_opening = 0 AND (particulars LIKE ? OR person LIKE ?)`;
  const params: (number | string)[] = [firmId, `%${query}%`, `%${query}%`];
  if (dateFrom) { q += " AND date >= ?"; params.push(dateFrom); }
  if (dateTo) { q += " AND date <= ?"; params.push(dateTo); }
  q += " ORDER BY date ASC, id ASC";

  const vouchers = db.prepare(q).all(...params) as any[];
  const firm = db.prepare("SELECT opening_balance FROM firms WHERE id = ?").get(firmId) as any;
  let runningBalance = firm?.opening_balance || 0;

  const entries = vouchers.map((v: any) => {
    const isPayment = ["Cash Payment", "Bank Payment", "Purchase"].includes(v.voucher_type);
    runningBalance = isPayment ? runningBalance - v.amount : runningBalance + v.amount;
    return { id: v.id, date: v.date, voucherNo: v.voucher_no, voucherType: v.voucher_type, mode: v.mode, particulars: v.particulars, person: v.person, amount: v.amount, runningBalance };
  });

  res.json(entries);
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
    drLedger: v.dr_ledger,
    crLedger: v.cr_ledger,
    amount: v.amount,
    narration: v.narration,
    isOpening: v.is_opening === 1,
    createdAt: v.created_at,
    createdBy: v.created_by,
  };
}

export default router;
