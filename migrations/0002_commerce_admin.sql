ALTER TABLE products ADD COLUMN supplier_cost_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN markup_percent REAL NOT NULL DEFAULT 35;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_supplier_sku ON products(supplier_sku) WHERE supplier_sku IS NOT NULL;

ALTER TABLE orders ADD COLUMN country_id INTEGER;
ALTER TABLE orders ADD COLUMN state TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN city TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN address2 TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN postcode TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN telephone TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN shipping_way_id INTEGER;
ALTER TABLE orders ADD COLUMN payment_confirmed_at TEXT;
ALTER TABLE orders ADD COLUMN supplier_error TEXT;

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_ip ON admin_login_attempts(ip, created_at);
INSERT OR IGNORE INTO app_settings(key,value) VALUES ('sunsky_sync_page','1');
UPDATE products SET stock_status='demo', active=0 WHERE supplier_sku IS NULL AND id LIKE 'demo-%';
