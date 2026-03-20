-- Migration 022: Comptes et transferts entre comptes
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'other',
  notes TEXT DEFAULT '',
  icon TEXT DEFAULT 'wallet',
  color TEXT DEFAULT '#6366f1',
  opening_balance INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);

CREATE TABLE IF NOT EXISTS account_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  to_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK(amount > 0),
  fee INTEGER NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  time TEXT NOT NULL DEFAULT '00:00',
  notes TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CHECK(from_account_id != to_account_id)
);

CREATE INDEX IF NOT EXISTS idx_account_transfers_user_date ON account_transfers(user_id, date DESC);
