PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  stock_status TEXT NOT NULL DEFAULT 'unknown',
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0,1)),
  supplier_sku TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(active, category);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  shipping_country TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  items_json TEXT NOT NULL,
  payment_provider_ref TEXT,
  supplier_order_ref TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at);
CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  status TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO products (id,slug,title,category,description,image_url,price_cents,currency,stock_status,featured)
VALUES
('demo-001','minimal-travel-backpack','Minimal Travel Backpack','Bags','A clean everyday carry with room for the essentials.','https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85',4890,'USD','demo',1),
('demo-002','studio-wireless-headphones','Studio Wireless Headphones','Electronics','Comfort-first listening for work, travel, and downtime.','https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=85',7290,'USD','demo',1),
('demo-003','ceramic-desk-set','Ceramic Desk Set','Home','A considered little upgrade for your workspace.','https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1000&q=85',3250,'USD','demo',1),
('demo-004','everyday-crossbody','Everyday Crossbody','Bags','Lightweight, versatile, and ready for daily use.','https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85',3990,'USD','demo',0),
('demo-005','portable-desk-lamp','Portable Desk Lamp','Home','Soft ambient light with a compact modern profile.','https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1000&q=85',5690,'USD','demo',0),
('demo-006','compact-bluetooth-speaker','Compact Bluetooth Speaker','Electronics','A small footprint with room-filling sound.','https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=1000&q=85',4490,'USD','demo',0);
