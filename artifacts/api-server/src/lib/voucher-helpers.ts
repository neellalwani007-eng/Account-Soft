import db from "./db.js";

export function getFinancialYear(date: string): string {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  if (month >= 4) {
    const yy1 = String(year).slice(2);
    const yy2 = String(year + 1).slice(2);
    return `${yy1}-${yy2}`;
  } else {
    const yy1 = String(year - 1).slice(2);
    const yy2 = String(year).slice(2);
    return `${yy1}-${yy2}`;
  }
}

export function getNextVoucherNumber(firmId: number, date?: string): string {
  const firm = db.prepare("SELECT prefix FROM firms WHERE id = ?").get(firmId) as { prefix: string } | undefined;
  if (!firm) throw new Error("Firm not found");

  const fy = getFinancialYear(date || new Date().toISOString().split("T")[0]);
  const countRow = db.prepare(
    "SELECT COUNT(*) as cnt FROM vouchers WHERE firm_id = ? AND is_opening = 0"
  ).get(firmId) as { cnt: number };

  const next = (countRow.cnt + 1).toString().padStart(3, "0");
  return `${firm.prefix}/${fy}/${next}`;
}

export function postLedgerEntries(
  voucherId: number,
  firmId: number,
  date: string,
  voucherType: string,
  particulars: string,
  person: string,
  drLedger: string | undefined,
  crLedger: string | undefined,
  amount: number,
  narration?: string
): void {
  const partyName = [particulars, person].filter(Boolean).join(" - ") || "Unknown";

  let drAccount: string;
  let crAccount: string;

  switch (voucherType) {
    case "Cash Receipt":
      drAccount = "Cash Account";
      crAccount = partyName;
      break;
    case "Cash Payment":
      drAccount = partyName;
      crAccount = "Cash Account";
      break;
    case "Bank Receipt":
    case "Bank":
      drAccount = "Bank Account";
      crAccount = partyName;
      break;
    case "Bank Payment":
      drAccount = partyName;
      crAccount = "Bank Account";
      break;
    case "Journal":
      drAccount = drLedger || "Unknown";
      crAccount = crLedger || "Unknown";
      break;
    case "Sale":
      drAccount = "Cash Account";
      crAccount = "Sales Account";
      break;
    case "Purchase":
      drAccount = "Purchase Account";
      crAccount = "Cash Account";
      break;
    default:
      drAccount = drLedger || partyName;
      crAccount = crLedger || "Cash Account";
  }

  const insert = db.prepare(`
    INSERT INTO ledger_entries (voucher_id, firm_id, date, ledger_name, contra_account, side, amount, narration, voucher_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(voucherId, firmId, date, drAccount, crAccount, "Dr", amount, narration || null, voucherType);
  insert.run(voucherId, firmId, date, crAccount, drAccount, "Cr", amount, narration || null, voucherType);

  ensureLedgerExists(firmId, drAccount, getLedgerGroup(drAccount));
  ensureLedgerExists(firmId, crAccount, getLedgerGroup(crAccount));
}

function getLedgerGroup(name: string): string {
  if (name === "Cash Account") return "Cash & Bank";
  if (name === "Bank Account") return "Cash & Bank";
  if (name === "Sales Account") return "Income";
  if (name === "Purchase Account") return "Expense";
  return "Sundry Debtors";
}

function ensureLedgerExists(firmId: number, name: string, group: string): void {
  db.prepare(
    "INSERT OR IGNORE INTO ledger_list (firm_id, name, group_name) VALUES (?, ?, ?)"
  ).run(firmId, name, group);
}

export function getCashBalance(firmId: number, asOfDate?: string): number {
  let query = `
    SELECT 
      COALESCE(SUM(CASE WHEN voucher_type IN ('Cash Receipt','Sale') THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN voucher_type IN ('Cash Payment','Purchase') THEN amount ELSE 0 END), 0) as balance
    FROM vouchers
    WHERE firm_id = ? AND is_opening = 0
  `;
  const params: (number | string)[] = [firmId];

  if (asOfDate) {
    query += " AND date <= ?";
    params.push(asOfDate);
  }

  const firm = db.prepare("SELECT opening_balance FROM firms WHERE id = ?").get(firmId) as { opening_balance: number } | undefined;
  const opening = firm?.opening_balance || 0;

  const row = db.prepare(query).get(...params) as { balance: number };
  return opening + (row?.balance || 0);
}
