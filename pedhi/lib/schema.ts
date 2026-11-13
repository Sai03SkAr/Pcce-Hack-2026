export const SCHEMA = `
CREATE TABLE IF NOT EXISTS orgs (id INTEGER PRIMARY KEY, name TEXT NOT NULL, upi_id TEXT, gstin TEXT, state TEXT NOT NULL DEFAULT 'Goa', books_from TEXT,
  remind_after_days INTEGER, remind_every_days INTEGER NOT NULL DEFAULT 7);
CREATE TABLE IF NOT EXISTS branches (id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL, name TEXT NOT NULL, code TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL, branch_id INTEGER,
  name TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('owner','family','manager','staff','ca')),
  title TEXT, phone TEXT, lang TEXT NOT NULL DEFAULT 'en');
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL, name TEXT NOT NULL, aliases TEXT NOT NULL DEFAULT '',
  category TEXT, unit TEXT NOT NULL DEFAULT 'pc', hsn TEXT, gst_rate INTEGER NOT NULL DEFAULT 18,
  cost INTEGER NOT NULL, price INTEGER NOT NULL, lead_days INTEGER NOT NULL DEFAULT 3);
CREATE TABLE IF NOT EXISTS stock (
  item_id INTEGER NOT NULL, branch_id INTEGER NOT NULL, qty INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (item_id, branch_id));
-- stock.qty is only ever changed alongside a row here
CREATE TABLE IF NOT EXISTS stock_moves (
  id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL, item_id INTEGER NOT NULL, branch_id INTEGER NOT NULL,
  day TEXT NOT NULL, type TEXT NOT NULL, qty INTEGER NOT NULL, ref TEXT, user_id INTEGER);
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL, branch_id INTEGER NOT NULL, name TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '', phone TEXT, credit_limit INTEGER NOT NULL DEFAULT 50000, notes TEXT,
  gstin TEXT, state TEXT NOT NULL DEFAULT 'Goa', credit_days INTEGER NOT NULL DEFAULT 30, opening_day TEXT,
  share_token TEXT, last_reminded TEXT);
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL, branch_id INTEGER NOT NULL, customer_id INTEGER,
  user_id INTEGER, day TEXT NOT NULL, ts TEXT NOT NULL, invoice_no TEXT NOT NULL,
  total INTEGER NOT NULL, tax INTEGER NOT NULL, cost_total INTEGER NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('cash','upi','credit')), source TEXT NOT NULL DEFAULT 'pos');
CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY, sale_id INTEGER NOT NULL, item_id INTEGER NOT NULL,
  qty INTEGER NOT NULL, price INTEGER NOT NULL, cost INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL, customer_id INTEGER NOT NULL, branch_id INTEGER NOT NULL,
  day TEXT NOT NULL, amount INTEGER NOT NULL, mode TEXT NOT NULL, user_id INTEGER, source TEXT NOT NULL DEFAULT 'pos');
CREATE TABLE IF NOT EXISTS cash_closings (
  id INTEGER PRIMARY KEY, branch_id INTEGER NOT NULL, day TEXT NOT NULL,
  expected INTEGER NOT NULL, counted INTEGER NOT NULL, user_id INTEGER);
CREATE TABLE IF NOT EXISTS insights (
  id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL, day TEXT NOT NULL, key TEXT NOT NULL, type TEXT NOT NULL,
  severity TEXT NOT NULL, branch_id INTEGER, impact INTEGER NOT NULL DEFAULT 0,
  title_en TEXT, title_hi TEXT, detail_en TEXT, detail_hi TEXT, action TEXT, status TEXT NOT NULL DEFAULT 'open');
CREATE TABLE IF NOT EXISTS briefs (
  id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL, day TEXT NOT NULL, lang TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'all', body TEXT NOT NULL, source TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL, user_id INTEGER NOT NULL, dir TEXT NOT NULL,
  body TEXT NOT NULL, ts TEXT NOT NULL, meta TEXT);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL, user_id INTEGER, ts TEXT NOT NULL,
  action TEXT NOT NULL, detail TEXT);
-- Books: Tally-style double entry. amount > 0 is a debit, < 0 a credit; every voucher sums to zero.
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL, name TEXT NOT NULL, aliases TEXT NOT NULL DEFAULT '',
  phone TEXT, gstin TEXT, state TEXT NOT NULL DEFAULT 'Goa', category TEXT);
CREATE TABLE IF NOT EXISTS ledgers (
  id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL, name TEXT NOT NULL, grp TEXT NOT NULL, kind TEXT NOT NULL,
  branch_id INTEGER, customer_id INTEGER, supplier_id INTEGER, rate INTEGER, opening INTEGER NOT NULL DEFAULT 0,
  UNIQUE (org_id, name));
CREATE TABLE IF NOT EXISTS vouchers (
  id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL, branch_id INTEGER, type TEXT NOT NULL, number TEXT NOT NULL, day TEXT NOT NULL,
  narration TEXT, party_ledger_id INTEGER, sale_id INTEGER, payment_id INTEGER, purchase_id INTEGER,
  source TEXT NOT NULL DEFAULT 'pos', user_id INTEGER, ts TEXT);
CREATE TABLE IF NOT EXISTS voucher_lines (id INTEGER PRIMARY KEY, voucher_id INTEGER NOT NULL, ledger_id INTEGER NOT NULL, amount INTEGER NOT NULL, bank_date TEXT);
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL, branch_id INTEGER NOT NULL, supplier_id INTEGER NOT NULL, day TEXT NOT NULL,
  bill_no TEXT, total INTEGER NOT NULL, user_id INTEGER);
CREATE TABLE IF NOT EXISTS purchase_items (id INTEGER PRIMARY KEY, purchase_id INTEGER NOT NULL, item_id INTEGER NOT NULL, qty INTEGER NOT NULL, rate INTEGER NOT NULL, expiry TEXT);
-- What a WhatsApp message would do, held until the sender replies YES (one per person)
CREATE TABLE IF NOT EXISTS pending (user_id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL, action TEXT NOT NULL, ts TEXT NOT NULL);
-- Goods coming back: from a customer (credit note) or to a supplier (debit note)
CREATE TABLE IF NOT EXISTS returns (
  id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('sale','purchase')), branch_id INTEGER NOT NULL,
  sale_id INTEGER, supplier_id INTEGER, day TEXT NOT NULL, total INTEGER NOT NULL, refund TEXT NOT NULL, user_id INTEGER, note TEXT, voucher_id INTEGER);
CREATE TABLE IF NOT EXISTS return_items (id INTEGER PRIMARY KEY, return_id INTEGER NOT NULL, item_id INTEGER NOT NULL, qty INTEGER NOT NULL, price INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS period_locks (id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL, upto TEXT NOT NULL, user_id INTEGER, ts TEXT NOT NULL, note TEXT);
CREATE INDEX IF NOT EXISTS vl_v ON voucher_lines (voucher_id);
CREATE INDEX IF NOT EXISTS vl_l ON voucher_lines (ledger_id);
CREATE INDEX IF NOT EXISTS v_day ON vouchers (org_id, day);
CREATE INDEX IF NOT EXISTS v_sale ON vouchers (sale_id);
CREATE INDEX IF NOT EXISTS v_pay ON vouchers (payment_id);
CREATE INDEX IF NOT EXISTS pi_p ON purchase_items (purchase_id);
CREATE INDEX IF NOT EXISTS ri_r ON return_items (return_id);
CREATE INDEX IF NOT EXISTS ret_sale ON returns (sale_id);
CREATE UNIQUE INDEX IF NOT EXISTS cust_token ON customers (share_token);
CREATE INDEX IF NOT EXISTS sales_day ON sales (org_id, day, branch_id);
CREATE INDEX IF NOT EXISTS sales_cust ON sales (customer_id);
CREATE INDEX IF NOT EXISTS si_sale ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS si_item ON sale_items (item_id);
CREATE INDEX IF NOT EXISTS pay_cust ON payments (customer_id);
CREATE INDEX IF NOT EXISTS moves_item ON stock_moves (item_id, branch_id);
`

export const TABLES = ['orgs', 'branches', 'users', 'items', 'stock', 'stock_moves', 'customers', 'sales',
  'sale_items', 'payments', 'cash_closings', 'insights', 'briefs', 'messages', 'audit',
  'suppliers', 'ledgers', 'vouchers', 'voucher_lines', 'purchases', 'purchase_items', 'period_locks', 'returns', 'return_items', 'pending']
