-- Migration 012: Liste des envies
CREATE TABLE IF NOT EXISTS wishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  target_date TEXT NOT NULL,
  estimated_amount INTEGER NOT NULL CHECK(estimated_amount >= 0),
  actual_amount INTEGER,
  category TEXT NOT NULL DEFAULT 'misc',
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','purchased')),
  expense_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wishes_target_date ON wishes(target_date);
CREATE INDEX IF NOT EXISTS idx_wishes_status ON wishes(status);
