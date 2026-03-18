-- Migration 009: autres revenus par mois (comme salaries)
CREATE TABLE IF NOT EXISTS other_incomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month INTEGER NOT NULL CHECK(month >= 0 AND month <= 11),
  year INTEGER NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  UNIQUE(month, year)
);

CREATE INDEX IF NOT EXISTS idx_other_incomes_year ON other_incomes(year);
