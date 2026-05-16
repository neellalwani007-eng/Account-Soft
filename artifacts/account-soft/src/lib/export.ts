import * as XLSX from "xlsx";

const INR = (val: number = 0) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(val);

// ─── Cash Book ────────────────────────────────────────────────────────────────

export interface CashBookEntry {
  particulars: string;
  person?: string | null;
  amount: number;
}

export interface CashBookDay {
  date: string;
  openingBalance: number;
  closingBalance: number;
  receipts: CashBookEntry[];
  payments: CashBookEntry[];
}

export interface CashBookData {
  days: CashBookDay[];
  totalReceipts?: number;
  totalPayments?: number;
  netFlow?: number;
}

export function exportCashBookToExcel(
  data: CashBookData,
  firmName: string,
  dateFrom: string,
  dateTo: string
) {
  const wb = XLSX.utils.book_new();

  const header = [
    [`${firmName} — Cash Book`],
    [`Period: ${dateFrom} to ${dateTo}`],
    [],
    ["DR — RECEIPTS", "", "CR — PAYMENTS", ""],
    ["Particulars", "Amount (₹)", "Particulars", "Amount (₹)"],
  ];

  const rows: (string | number)[][] = [];

  for (const day of data.days) {
    rows.push([`Date: ${day.date}`, "", "", ""]);
    rows.push([
      `Opening Balance`,
      day.openingBalance,
      "",
      "",
    ]);

    const maxLen = Math.max(day.receipts.length, day.payments.length);
    for (let i = 0; i < maxLen; i++) {
      const r = day.receipts[i];
      const p = day.payments[i];
      rows.push([
        r ? `${r.particulars}${r.person ? ` (${r.person})` : ""}` : "",
        r ? r.amount : "",
        p ? `${p.particulars}${p.person ? ` (${p.person})` : ""}` : "",
        p ? p.amount : "",
      ]);
    }

    const drTotal =
      day.openingBalance + day.receipts.reduce((s, r) => s + r.amount, 0);
    const crTotal =
      day.closingBalance + day.payments.reduce((s, p) => s + p.amount, 0);
    rows.push(["Closing Balance", day.closingBalance, "Closing Balance", day.closingBalance]);
    rows.push([`Total`, drTotal, `Total`, crTotal]);
    rows.push(["", "", "", ""]);
  }

  rows.push(["", "", "", ""]);
  rows.push([
    "TOTAL RECEIPTS",
    data.totalReceipts ?? 0,
    "TOTAL PAYMENTS",
    data.totalPayments ?? 0,
  ]);
  rows.push(["NET FLOW", data.netFlow ?? 0, "", ""]);

  const ws = XLSX.utils.aoa_to_sheet([...header, ...rows]);
  ws["!cols"] = [{ wch: 40 }, { wch: 18 }, { wch: 40 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, "Cash Book");
  XLSX.writeFile(wb, `CashBook_${firmName}_${dateFrom}_${dateTo}.xlsx`);
}

export function exportCashBookToPdf(
  data: CashBookData,
  firmName: string,
  dateFrom: string,
  dateTo: string
) {
  const printWin = window.open("", "_blank", "width=900,height=700");
  if (!printWin) return;

  const daysHtml = data.days
    .map((day) => {
      const maxLen = Math.max(day.receipts.length, day.payments.length, 1);
      const receiptRows = Array.from({ length: maxLen }, (_, i) => {
        const r = day.receipts[i];
        return r
          ? `<tr><td>${r.particulars}${r.person ? `<br/><small>${r.person}</small>` : ""}</td><td class="amt">${INR(r.amount)}</td></tr>`
          : `<tr><td></td><td></td></tr>`;
      });
      const paymentRows = Array.from({ length: maxLen }, (_, i) => {
        const p = day.payments[i];
        return p
          ? `<tr><td>${p.particulars}${p.person ? `<br/><small>${p.person}</small>` : ""}</td><td class="amt">${INR(p.amount)}</td></tr>`
          : `<tr><td></td><td></td></tr>`;
      });
      const drTotal =
        day.openingBalance + day.receipts.reduce((s, r) => s + r.amount, 0);
      const crTotal =
        day.closingBalance + day.payments.reduce((s, p) => s + p.amount, 0);

      return `
        <div class="day-block">
          <div class="day-header">
            <span>${new Date(day.date).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</span>
            <span>Opening: ${INR(day.openingBalance)} &nbsp;|&nbsp; Closing: ${INR(day.closingBalance)}</span>
          </div>
          <table class="cb-table">
            <thead>
              <tr>
                <th colspan="2" class="dr-head">DR — RECEIPTS</th>
                <th colspan="2" class="cr-head">CR — PAYMENTS</th>
              </tr>
              <tr>
                <th>Particulars</th><th>Amount</th>
                <th>Particulars</th><th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><i>Opening Balance</i></td><td class="amt"><i>${INR(day.openingBalance)}</i></td>
                <td></td><td></td>
              </tr>
              ${Array.from({ length: maxLen }, (_, i) => {
                const r = day.receipts[i];
                const p = day.payments[i];
                return `<tr>
                  <td>${r ? `${r.particulars}${r.person ? `<br/><small class="sub">${r.person}</small>` : ""}` : ""}</td>
                  <td class="amt">${r ? INR(r.amount) : ""}</td>
                  <td>${p ? `${p.particulars}${p.person ? `<br/><small class="sub">${p.person}</small>` : ""}` : ""}</td>
                  <td class="amt">${p ? INR(p.amount) : ""}</td>
                </tr>`;
              }).join("")}
              <tr>
                <td></td><td></td>
                <td><i>Closing Balance</i></td><td class="amt"><i>${INR(day.closingBalance)}</i></td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td class="total-label">Total</td><td class="amt total-val">${INR(drTotal)}</td>
                <td class="total-label">Total</td><td class="amt total-val">${INR(crTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>`;
    })
    .join("");

  printWin.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Cash Book — ${firmName}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; margin: 20px; }
  h1 { font-size: 16px; margin: 0; }
  h2 { font-size: 12px; font-weight: normal; color: #555; margin: 4px 0 16px; }
  .day-block { margin-bottom: 24px; page-break-inside: avoid; }
  .day-header { background: #f0f0f0; padding: 6px 10px; display: flex; justify-content: space-between; font-weight: bold; border: 1px solid #ccc; border-bottom: none; font-size: 11px; }
  .cb-table { width: 100%; border-collapse: collapse; }
  .cb-table th, .cb-table td { border: 1px solid #ccc; padding: 4px 8px; vertical-align: top; }
  .cb-table th { background: #e8e8e8; font-size: 10px; text-transform: uppercase; }
  .dr-head { background: #d4edda; color: #155724; text-align: center; }
  .cr-head { background: #f8d7da; color: #721c24; text-align: center; }
  .amt { text-align: right; white-space: nowrap; }
  .total-label { font-weight: bold; background: #f8f8f8; }
  .total-val { font-weight: bold; background: #f8f8f8; }
  .sub { color: #666; font-size: 9px; }
  .summary { margin-top: 16px; border: 2px solid #333; padding: 10px 16px; display: flex; gap: 40px; }
  .summary-item span { display: block; font-size: 9px; text-transform: uppercase; color: #666; }
  .summary-item strong { font-size: 14px; }
  @media print { body { margin: 10px; } }
</style>
</head>
<body>
<h1>${firmName} — Cash Book</h1>
<h2>Period: ${dateFrom} to ${dateTo}</h2>
${daysHtml}
<div class="summary">
  <div class="summary-item"><span>Total Receipts</span><strong>${INR(data.totalReceipts)}</strong></div>
  <div class="summary-item"><span>Total Payments</span><strong>${INR(data.totalPayments)}</strong></div>
  <div class="summary-item"><span>Net Flow</span><strong>${INR(data.netFlow)}</strong></div>
</div>
</body>
</html>`);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => printWin.print(), 500);
}

// ─── Day Book ─────────────────────────────────────────────────────────────────

export interface DayBookEntry {
  date: string;
  voucherNo?: string | null;
  voucherType: string;
  particulars?: string | null;
  person?: string | null;
  amount: number;
  runningBalance?: number;
}

export function exportDayBookToExcel(
  rows: DayBookEntry[],
  firmName: string,
  dateFrom: string,
  dateTo: string
) {
  const wb = XLSX.utils.book_new();

  const header = [
    [`${firmName} — Day Book`],
    [`Period: ${dateFrom} to ${dateTo}`],
    [],
    ["Date", "Voucher No", "Type", "Particulars", "Party", "Amount (₹)", "Balance (₹)"],
  ];

  const data = rows.map((r) => [
    r.date,
    r.voucherNo ?? "",
    r.voucherType,
    r.particulars ?? "",
    r.person ?? "",
    r.amount,
    r.runningBalance ?? "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...header, ...data]);
  ws["!cols"] = [
    { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 30 },
    { wch: 22 }, { wch: 16 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Day Book");
  XLSX.writeFile(wb, `DayBook_${firmName}_${dateFrom}_${dateTo}.xlsx`);
}

export function exportDayBookToPdf(
  rows: DayBookEntry[],
  firmName: string,
  dateFrom: string,
  dateTo: string
) {
  const printWin = window.open("", "_blank", "width=900,height=700");
  if (!printWin) return;

  const rowsHtml = rows
    .map(
      (r) => `
    <tr>
      <td>${new Date(r.date).toLocaleDateString("en-IN")}</td>
      <td class="mono">${r.voucherNo ?? ""}</td>
      <td><span class="badge">${r.voucherType}</span></td>
      <td>${r.particulars ?? ""}</td>
      <td>${r.person ?? ""}</td>
      <td class="amt">${INR(r.amount)}</td>
      <td class="amt">${r.runningBalance != null ? INR(r.runningBalance) : ""}</td>
    </tr>`
    )
    .join("");

  printWin.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Day Book — ${firmName}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; margin: 20px; }
  h1 { font-size: 16px; margin: 0; }
  h2 { font-size: 12px; font-weight: normal; color: #555; margin: 4px 0 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 5px 8px; vertical-align: top; }
  th { background: #e8e8e8; font-size: 10px; text-transform: uppercase; text-align: left; }
  .amt { text-align: right; white-space: nowrap; }
  .mono { font-family: monospace; font-size: 10px; color: #444; }
  .badge { background: #eee; border: 1px solid #ccc; border-radius: 3px; padding: 1px 5px; font-size: 9px; text-transform: uppercase; white-space: nowrap; }
  @media print { body { margin: 10px; } }
</style>
</head>
<body>
<h1>${firmName} — Day Book</h1>
<h2>Period: ${dateFrom} to ${dateTo}</h2>
<table>
  <thead>
    <tr>
      <th>Date</th><th>Voucher No</th><th>Type</th>
      <th>Particulars</th><th>Party</th>
      <th>Amount</th><th>Balance</th>
    </tr>
  </thead>
  <tbody>${rowsHtml}</tbody>
</table>
</body>
</html>`);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => printWin.print(), 500);
}

// ─── Monthly Summary ──────────────────────────────────────────────────────────

export interface MonthlySummaryRow {
  month: string;
  receipts: number;
  payments: number;
  net: number;
}

export interface MonthlySummaryData {
  rows?: MonthlySummaryRow[];
  totalReceipts?: number;
  totalPayments?: number;
  totalNet?: number;
}

export function exportMonthlySummaryToExcel(
  data: MonthlySummaryData,
  firmName: string,
  financialYear: string
) {
  const wb = XLSX.utils.book_new();

  const header = [
    [`${firmName} — Monthly Summary`],
    [`Financial Year: ${financialYear}`],
    [],
    ["Month", "Receipts (₹)", "Payments (₹)", "Net Flow (₹)"],
  ];

  const rows = (data.rows ?? []).map((r) => [
    r.month,
    r.receipts,
    r.payments,
    r.net,
  ]);

  rows.push([]);
  rows.push(["TOTAL", data.totalReceipts ?? 0, data.totalPayments ?? 0, data.totalNet ?? 0]);

  const ws = XLSX.utils.aoa_to_sheet([...header, ...rows]);
  ws["!cols"] = [{ wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, "Monthly Summary");
  XLSX.writeFile(wb, `MonthlySummary_${firmName}_FY${financialYear}.xlsx`);
}

export function exportMonthlySummaryToPdf(
  data: MonthlySummaryData,
  firmName: string,
  financialYear: string
) {
  const printWin = window.open("", "_blank", "width=700,height=600");
  if (!printWin) return;

  const rowsHtml = (data.rows ?? [])
    .map(
      (r) => `
    <tr>
      <td>${r.month}</td>
      <td class="amt green">${INR(r.receipts)}</td>
      <td class="amt red">${INR(r.payments)}</td>
      <td class="amt ${r.net < 0 ? "red" : "green"}">${INR(r.net)}</td>
    </tr>`
    )
    .join("");

  printWin.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Monthly Summary — ${firmName}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; margin: 20px; }
  h1 { font-size: 16px; margin: 0; }
  h2 { font-size: 12px; font-weight: normal; color: #555; margin: 4px 0 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; }
  th { background: #e8e8e8; font-size: 10px; text-transform: uppercase; text-align: left; }
  .amt { text-align: right; white-space: nowrap; }
  .green { color: #155724; }
  .red { color: #721c24; }
  tfoot td { font-weight: bold; background: #f8f8f8; border-top: 2px solid #999; }
  @media print { body { margin: 10px; } }
</style>
</head>
<body>
<h1>${firmName} — Monthly Summary</h1>
<h2>Financial Year: ${financialYear}</h2>
<table>
  <thead>
    <tr>
      <th>Month</th><th>Receipts</th><th>Payments</th><th>Net Flow</th>
    </tr>
  </thead>
  <tbody>${rowsHtml}</tbody>
  <tfoot>
    <tr>
      <td>TOTAL</td>
      <td class="amt green">${INR(data.totalReceipts)}</td>
      <td class="amt red">${INR(data.totalPayments)}</td>
      <td class="amt">${INR(data.totalNet)}</td>
    </tr>
  </tfoot>
</table>
</body>
</html>`);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => printWin.print(), 500);
}
