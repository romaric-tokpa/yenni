-- Migration 016: Listes d'envies (structure comme listes de courses)
CREATE TABLE IF NOT EXISTS wish_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wish_list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id INTEGER NOT NULL REFERENCES wish_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_date TEXT NOT NULL,
  estimated_amount INTEGER NOT NULL CHECK(estimated_amount >= 0),
  actual_amount INTEGER,
  category TEXT NOT NULL DEFAULT 'misc',
  subcategory TEXT,
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','purchased')),
  purchased_at TEXT,
  expense_id INTEGER,
  shop_name TEXT,
  shop_phone TEXT,
  shop_address TEXT,
  shop_lat REAL,
  shop_lng REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wish_list_items_list ON wish_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_wish_list_items_target ON wish_list_items(target_date);
CREATE INDEX IF NOT EXISTS idx_wish_list_items_status ON wish_list_items(status);
CREATE INDEX IF NOT EXISTS idx_wish_lists_scheduled ON wish_lists(scheduled_date);
