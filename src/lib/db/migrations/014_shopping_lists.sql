-- Migration 014: Listes de courses
CREATE TABLE IF NOT EXISTS shopping_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id INTEGER NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  estimated_amount INTEGER NOT NULL CHECK(estimated_amount >= 0),
  actual_amount INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','purchased')),
  purchased_at TEXT,
  expense_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shopping_list_items_list ON shopping_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_scheduled ON shopping_lists(scheduled_date);
