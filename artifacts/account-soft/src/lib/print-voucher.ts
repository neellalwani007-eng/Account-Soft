const INR = (val: number = 0) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(val);

function numberToWords(num: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const crore = ["", "Thousand", "Lakh", "Crore"];

  if (num === 0) return "Zero";
  const chunks: number[] = [];
  let n = Math.floor(num);
  chunks.push(n % 1000); n = Math.floor(n / 1000);
  chunks.push(n % 100); n = Math.floor(n / 100);
  chunks.push(n % 100); n = Math.floor(n / 100);
  chunks.push(n % 100);

  function threeDigits(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + threeDigits(n % 100) : "");
  }

  const parts: string[] = [];
  const labels = ["", "Thousand", "Lakh", "Crore"];
  for (let i = chunks.length - 1; i >= 0; i--) {
    if (chunks[i]) parts.push(threeDigits(chunks[i]) + (labels[i] ? " " + labels[i] : ""));
  }
  const paise = Math.round((num - Math.floor(num)) * 100);
  let result = parts.join(" ");
  if (paise) result += " and " + threeDigits(paise) + " Paise";
  return result + " Only";
}

function printWindow(html: string) {
  const w = window.open("", "_blank", "width=960,height=700");
  if (!w) { alert("Please allow popups to print."); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 600);
}

function saveAsWord(html: string, filename: string) {
  const blob = new Blob([`\ufeff${html}`], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const commonStyles = `
  body { font-family: Arial, sans-serif; font-size: 12px; color: #000; margin: 0; padding: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #999; padding: 5px 8px; }
  th { background: #f2f2f2; font-size: 11px; text-transform: uppercase; }
  .right { text-align: right; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
  .firm-name { font-size: 20px; font-weight: bold; }
  .firm-sub { font-size: 11px; color: #555; margin-top: 2px; }
  .invoice-title { font-size: 16px; font-weight: bold; text-align: center; border: 2px solid #000; padding: 6px 20px; }
  .section { margin-bottom: 12px; }
  .label { font-size: 10px; color: #666; text-transform: uppercase; }
  .value { font-size: 12px; font-weight: bold; }
  .total-row td { font-weight: bold; background: #f9f9f9; }
  .grand-total td { font-weight: bold; font-size: 14px; background: #eee; border-top: 2px solid #333; }
  .footer { margin-top: 24px; display: flex; justify-content: space-between; border-top: 1px solid #ccc; padding-top: 16px; }
  .words-box { border: 1px solid #ccc; padding: 8px 12px; margin-top: 10px; font-style: italic; font-size: 11px; }
  @media print { body { padding: 8px; } @page { size: A4; margin: 10mm; } }
`;

// ─── GST Tax Invoice ──────────────────────────────────────────────────────────

export interface SaleItem {
  description: string;
  hsnCode?: string | null;
  qty: number;
  unit?: string | null;
  rate: number;
  gstRate?: number | null;
  amount: number;
}

export interface SaleVoucher {
  id?: number;
  voucherNo?: string | null;
  date: string;
  partyName?: string | null;
  partyGst?: string | null;
  paymentMode?: string | null;
  isGstInvoice?: boolean;
  narration?: string | null;
  subtotal?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  grandTotal?: number;
  items?: SaleItem[];
}

export interface FirmInfo {
  name: string;
  address?: string | null;
  gstNumber?: string | null;
  phone?: string | null;
}

function buildGstInvoiceHtml(sale: SaleVoucher, firm: FirmInfo, type: "Sale" | "Purchase"): string {
  const items = sale.items ?? [];
  const isGst = sale.isGstInvoice ?? true;
  const subtotal = sale.subtotal ?? items.reduce((s, i) => s + i.amount, 0);
  const cgst = sale.cgst ?? 0;
  const sgst = sale.sgst ?? 0;
  const igst = sale.igst ?? 0;
  const grand = sale.grandTotal ?? (subtotal + cgst + sgst + igst);

  const itemRows = items.map((item, idx) => `
    <tr>
      <td class="center">${idx + 1}</td>
      <td>${item.description}</td>
      <td class="center">${item.hsnCode ?? ""}</td>
      <td class="center">${item.qty}</td>
      <td class="center">${item.unit ?? "PCS"}</td>
      <td class="right">${INR(item.rate)}</td>
      <td class="right">${INR(item.amount)}</td>
      ${isGst ? `<td class="center">${item.gstRate ?? 0}%</td>
      <td class="right">${INR(item.amount * (item.gstRate ?? 0) / 100 / 2)}</td>
      <td class="right">${INR(item.amount * (item.gstRate ?? 0) / 100 / 2)}</td>
      <td class="right">${INR(item.amount + item.amount * (item.gstRate ?? 0) / 100)}</td>` : ""}
    </tr>`).join("");

  const title = isGst
    ? (type === "Sale" ? "TAX INVOICE" : "PURCHASE INVOICE")
    : (type === "Sale" ? "SALE RECEIPT" : "PURCHASE RECEIPT");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>${title} — ${sale.voucherNo}</title>
  <style>${commonStyles}
    .party-box { border: 1px solid #ccc; padding: 10px; flex: 1; }
    .invoice-meta { min-width: 220px; border: 1px solid #ccc; padding: 10px; }
    .top-section { display: flex; gap: 12px; margin-bottom: 12px; }
    .gst-badge { display: inline-block; background: #1a73e8; color: #fff; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: bold; margin-left: 8px; }
  </style>
  </head><body>
  <div class="header">
    <div>
      <div class="firm-name">${firm.name}</div>
      ${firm.address ? `<div class="firm-sub">${firm.address}</div>` : ""}
      ${firm.gstNumber ? `<div class="firm-sub">GSTIN: <b>${firm.gstNumber}</b></div>` : ""}
      ${firm.phone ? `<div class="firm-sub">Ph: ${firm.phone}</div>` : ""}
    </div>
    <div class="invoice-title">${title}${isGst ? `<span class="gst-badge">GST</span>` : ""}</div>
  </div>

  <div class="top-section">
    <div class="party-box">
      <div class="label">Bill To / Party</div>
      <div class="value">${sale.partyName ?? "—"}</div>
      ${sale.partyGst ? `<div class="firm-sub">GSTIN: ${sale.partyGst}</div>` : ""}
    </div>
    <div class="invoice-meta">
      <table style="border:none;">
        <tr style="border:none;"><td style="border:none;" class="label">Invoice No</td><td style="border:none;" class="bold">${sale.voucherNo ?? "—"}</td></tr>
        <tr style="border:none;"><td style="border:none;" class="label">Date</td><td style="border:none;" class="bold">${new Date(sale.date).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })}</td></tr>
        <tr style="border:none;"><td style="border:none;" class="label">Payment Mode</td><td style="border:none;" class="bold">${sale.paymentMode ?? "Cash"}</td></tr>
      </table>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center" style="width:32px">#</th>
        <th>Description</th>
        <th class="center">HSN</th>
        <th class="center">Qty</th>
        <th class="center">Unit</th>
        <th class="right">Rate</th>
        <th class="right">Amount</th>
        ${isGst ? `<th class="center">GST%</th><th class="right">CGST</th><th class="right">SGST</th><th class="right">Total</th>` : ""}
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="${isGst ? 6 : 5}" class="right bold">Subtotal</td>
        <td class="right bold">${INR(subtotal)}</td>
        ${isGst ? `<td></td><td class="right">${INR(cgst)}</td><td class="right">${INR(sgst)}</td><td class="right">${INR(subtotal + cgst + sgst)}</td>` : ""}
      </tr>
      ${isGst ? `
      <tr class="total-row">
        <td colspan="6" class="right">CGST Total</td>
        <td class="right">${INR(cgst)}</td><td></td><td colspan="3" class="right">${INR(cgst)}</td>
      </tr>
      <tr class="total-row">
        <td colspan="6" class="right">SGST Total</td>
        <td class="right">${INR(sgst)}</td><td></td><td colspan="3" class="right">${INR(sgst)}</td>
      </tr>` : ""}
      <tr class="grand-total">
        <td colspan="${isGst ? 10 : 6}" class="right">GRAND TOTAL</td>
        <td class="right">${INR(grand)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="words-box">Amount in words: <b>${numberToWords(grand)}</b></div>
  ${sale.narration ? `<div style="margin-top:8px;font-size:11px;color:#555;">Note: ${sale.narration}</div>` : ""}

  <div class="footer">
    <div>
      <div class="label">For Customer / Received by</div>
      <div style="margin-top:40px;border-top:1px solid #999;padding-top:4px;width:180px;text-align:center;font-size:10px;">Signature</div>
    </div>
    <div class="right">
      <div class="label">For ${firm.name}</div>
      <div style="margin-top:40px;border-top:1px solid #999;padding-top:4px;width:180px;text-align:center;font-size:10px;">Authorised Signatory</div>
    </div>
  </div>
  <div style="text-align:center;font-size:10px;color:#999;margin-top:16px;">This is a computer generated ${title.toLowerCase()}</div>
  </body></html>`;
}

export function printGstInvoice(sale: SaleVoucher, firm: FirmInfo, type: "Sale" | "Purchase" = "Sale") {
  printWindow(buildGstInvoiceHtml(sale, firm, type));
}

export function exportGstInvoiceWord(sale: SaleVoucher, firm: FirmInfo, type: "Sale" | "Purchase" = "Sale") {
  const html = buildGstInvoiceHtml(sale, firm, type);
  const filename = `Invoice_${sale.voucherNo ?? "draft"}_${sale.date}.doc`;
  saveAsWord(html, filename);
}

// ─── Cash Voucher ─────────────────────────────────────────────────────────────

export interface CashVoucher {
  voucherNo?: string | null;
  date: string;
  voucherType: string;
  particulars?: string | null;
  person?: string | null;
  amount: number;
  narration?: string | null;
}

function buildCashVoucherHtml(v: CashVoucher, firm: FirmInfo): string {
  const isReceipt = v.voucherType === "Receipt" || v.voucherType === "Cash Receipt";
  const label = isReceipt ? "CASH RECEIPT" : v.voucherType === "Bank" ? "BANK VOUCHER" : "CASH PAYMENT";
  const drLabel = isReceipt ? "Cash A/c" : (v.particulars ?? "Account");
  const crLabel = isReceipt ? (v.particulars ?? "Account") : "Cash A/c";
  const color = isReceipt ? "#1a7a1a" : "#c0392b";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>${label} — ${v.voucherNo}</title>
  <style>${commonStyles}
    .voucher-box { border: 2px solid #333; max-width: 720px; margin: 0 auto; padding: 24px; }
    .type-label { display: inline-block; border: 2px solid ${color}; color: ${color}; font-size: 18px; font-weight: bold; padding: 4px 24px; letter-spacing: 2px; }
    .posting-table td { border: none; padding: 6px 10px; font-size: 13px; }
    .posting-table .head-col { font-weight: bold; width: 120px; color: #555; font-size: 11px; text-transform: uppercase; }
  </style>
  </head><body>
  <div class="voucher-box">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
      <div>
        <div class="firm-name">${firm.name}</div>
        ${firm.address ? `<div class="firm-sub">${firm.address}</div>` : ""}
      </div>
      <div class="type-label">${label}</div>
    </div>
    <hr style="margin-bottom:16px;"/>

    <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
      <div>
        <span class="label">Voucher No: </span><span class="bold">${v.voucherNo ?? "—"}</span>
      </div>
      <div>
        <span class="label">Date: </span><span class="bold">${new Date(v.date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</span>
      </div>
    </div>

    <table class="posting-table" style="margin-bottom:16px;">
      <tr>
        <td class="head-col">Dr</td>
        <td class="bold" style="font-size:15px;">${drLabel}</td>
        <td class="right bold" style="font-size:15px;">${INR(v.amount)}</td>
      </tr>
      <tr>
        <td class="head-col">To Cr</td>
        <td>${crLabel}</td>
        <td class="right">${INR(v.amount)}</td>
      </tr>
    </table>
    <hr/>

    <div style="margin:12px 0;">
      <span class="label">Party / Person: </span>
      <span class="bold">${v.person ?? "—"}</span>
    </div>
    ${v.narration ? `<div style="margin:8px 0;"><span class="label">Narration: </span>${v.narration}</div>` : ""}

    <div class="words-box">Amount in Words: <b>${numberToWords(v.amount)}</b></div>

    <div class="footer" style="margin-top:32px;">
      <div class="center" style="min-width:160px;">
        <div style="border-top:1px solid #555;padding-top:6px;font-size:10px;">Prepared By</div>
      </div>
      <div class="center" style="min-width:160px;">
        <div style="border-top:1px solid #555;padding-top:6px;font-size:10px;">Received By</div>
      </div>
      <div class="center" style="min-width:160px;">
        <div style="border-top:1px solid #555;padding-top:6px;font-size:10px;">Authorised Signatory</div>
      </div>
    </div>
    <div style="text-align:center;font-size:10px;color:#999;margin-top:16px;">Computer generated voucher — ${firm.name}</div>
  </div>
  </body></html>`;
}

export function printCashVoucher(v: CashVoucher, firm: FirmInfo) {
  printWindow(buildCashVoucherHtml(v, firm));
}

export function exportCashVoucherWord(v: CashVoucher, firm: FirmInfo) {
  const html = buildCashVoucherHtml(v, firm);
  saveAsWord(html, `Voucher_${v.voucherNo ?? v.date}_${v.voucherType}.doc`);
}
