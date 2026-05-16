import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { runMigrations } from "./migrate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = process.env.DB_PATH || path.join(__dirname, "..", "..", "data");
const DB_FILE = path.join(DB_DIR, "accountsoft.db");

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_FILE);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS firms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    gst_number TEXT,
    phone TEXT,
    email TEXT,
    logo_path TEXT,
    prefix TEXT NOT NULL DEFAULT 'ACT',
    opening_balance REAL DEFAULT 0,
    opening_balance_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm_id INTEGER NOT NULL REFERENCES firms(id),
    date TEXT NOT NULL,
    voucher_no TEXT NOT NULL,
    voucher_type TEXT NOT NULL,
    mode TEXT,
    particulars TEXT,
    person TEXT,
    dr_ledger TEXT,
    cr_ledger TEXT,
    ledger_name TEXT,
    amount REAL NOT NULL DEFAULT 0,
    narration TEXT,
    cheque_no TEXT,
    bank_name TEXT,
    cheque_status TEXT DEFAULT 'Issued',
    is_opening INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT
  );

  CREATE TABLE IF NOT EXISTS ledger_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_id INTEGER REFERENCES vouchers(id) ON DELETE CASCADE,
    firm_id INTEGER NOT NULL REFERENCES firms(id),
    date TEXT NOT NULL,
    ledger_name TEXT NOT NULL,
    contra_account TEXT,
    side TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    narration TEXT,
    voucher_type TEXT
  );

  CREATE TABLE IF NOT EXISTS sale_vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm_id INTEGER NOT NULL REFERENCES firms(id),
    date TEXT NOT NULL,
    voucher_no TEXT NOT NULL,
    invoice_no TEXT,
    party_name TEXT NOT NULL,
    party_address TEXT,
    party_gst TEXT,
    party_phone TEXT,
    payment_mode TEXT NOT NULL DEFAULT 'Cash',
    is_gst_invoice INTEGER NOT NULL DEFAULT 0,
    narration TEXT,
    voucher_kind TEXT NOT NULL DEFAULT 'Sale',
    subtotal REAL DEFAULT 0,
    total_cgst REAL DEFAULT 0,
    total_sgst REAL DEFAULT 0,
    total_igst REAL DEFAULT 0,
    grand_total REAL NOT NULL DEFAULT 0,
    paid_amount REAL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_id INTEGER NOT NULL REFERENCES sale_vouchers(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    hsn_code TEXT,
    qty REAL NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'Nos',
    rate REAL NOT NULL DEFAULT 0,
    amount REAL NOT NULL DEFAULT 0,
    gst_rate REAL DEFAULT 0,
    cgst REAL DEFAULT 0,
    sgst REAL DEFAULT 0,
    igst REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS particulars_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm_id INTEGER NOT NULL REFERENCES firms(id),
    name TEXT NOT NULL,
    UNIQUE(firm_id, name)
  );

  CREATE TABLE IF NOT EXISTS persons_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm_id INTEGER NOT NULL REFERENCES firms(id),
    name TEXT NOT NULL,
    UNIQUE(firm_id, name)
  );

  CREATE TABLE IF NOT EXISTS ledger_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm_id INTEGER NOT NULL REFERENCES firms(id),
    name TEXT NOT NULL,
    group_name TEXT NOT NULL DEFAULT 'Expense',
    UNIQUE(firm_id, name)
  );

  CREATE TABLE IF NOT EXISTS closed_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm_id INTEGER NOT NULL REFERENCES firms(id),
    date TEXT NOT NULL,
    UNIQUE(firm_id, date)
  );

  CREATE TABLE IF NOT EXISTS parties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm_id INTEGER NOT NULL REFERENCES firms(id),
    name TEXT NOT NULL,
    address TEXT,
    gst_number TEXT,
    phone TEXT,
    email TEXT,
    party_type TEXT NOT NULL DEFAULT 'Both',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(firm_id, name)
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm_id INTEGER NOT NULL REFERENCES firms(id),
    name TEXT NOT NULL,
    hsn_code TEXT,
    unit TEXT DEFAULT 'PCS',
    rate REAL DEFAULT 0,
    gst_rate REAL DEFAULT 18,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(firm_id, name)
  );
`);

runMigrations(db);

const defaultSettings = [
  ["day_close_password", "confirm"],
  ["auto_close_at_midnight", "true"],
  ["default_payment_mode", "Cash"],
  ["bill_prefix", "BILL"],
  ["bill_language", "English"],
  ["active_firm_id", ""],
];

for (const [key, value] of defaultSettings) {
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run(key, value);
}

export default db;
