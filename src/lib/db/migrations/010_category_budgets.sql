-- Migration 010: budgets par catégorie et par mois
CREATE TABLE IF NOT EXISTS category_budgets (
  month INTEGER NOT NULL CHECK(month >= 0 AND month <= 11),
  year INTEGER NOT NULL,
  category_id TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0 CHECK(amount >= 0),
  PRIMARY KEY (month, year, category_id)
);

CREATE INDEX IF NOT EXISTS idx_category_budgets_year ON category_budgets(year);
