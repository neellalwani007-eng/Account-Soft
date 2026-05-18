import Database from "better-sqlite3";

export function runMigrations(db: InstanceType<typeof Database>) {
  const migrations = [
    // Add new columns to vouchers table if not present
    `ALTER TABLE vouchers ADD COLUMN ledger_name TEXT`,
    `ALTER TABLE vouchers ADD COLUMN cheque_no TEXT`,
    `ALTER TABLE vouchers ADD COLUMN bank_name TEXT`,
    `ALTER TABLE vouchers ADD COLUMN cheque_status TEXT DEFAULT 'Issued'`,
    // Add new columns to sale_vouchers if not present
    `ALTER TABLE sale_vouchers ADD COLUMN invoice_no TEXT`,
    `ALTER TABLE sale_vouchers ADD COLUMN party_address TEXT`,
    `ALTER TABLE sale_vouchers ADD COLUMN party_phone TEXT`,
    `ALTER TABLE sale_vouchers ADD COLUMN paid_amount REAL DEFAULT 0`,
    `ALTER TABLE ledger_list ADD COLUMN opening_balance REAL DEFAULT 0`,
  ];

  for (const sql of migrations) {
    try {
      db.exec(sql);
    } catch {
      // Column already exists — ignore
    }
  }
}
