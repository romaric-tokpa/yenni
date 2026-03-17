-- Migration 006: Tableau d'amortissement et planification des échéances
CREATE TABLE IF NOT EXISTS loan_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  principal INTEGER NOT NULL DEFAULT 0,
  interest INTEGER NOT NULL DEFAULT 0,
  insurance INTEGER NOT NULL DEFAULT 0,
  tax_interest INTEGER NOT NULL DEFAULT 0,
  tax_insurance INTEGER NOT NULL DEFAULT 0,
  fees INTEGER NOT NULL DEFAULT 0,
  total_payment INTEGER NOT NULL DEFAULT 0,
  remaining_balance INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('paid','pending','overdue','upcoming')),
  paid_at DATETIME DEFAULT NULL,
  payment_note TEXT DEFAULT '',
  UNIQUE(loan_id, number)
);

CREATE INDEX IF NOT EXISTS idx_loan_schedule_loan ON loan_schedule(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_schedule_status ON loan_schedule(status);
CREATE INDEX IF NOT EXISTS idx_loan_schedule_due_date ON loan_schedule(due_date);
CREATE INDEX IF NOT EXISTS idx_loan_schedule_user ON loan_schedule(user_id);

ALTER TABLE loans ADD COLUMN insurance_rate REAL NOT NULL DEFAULT 0;
ALTER TABLE loans ADD COLUMN tax_rate REAL NOT NULL DEFAULT 0;
ALTER TABLE loans ADD COLUMN fees_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE loans ADD COLUMN effective_rate REAL NOT NULL DEFAULT 0;
ALTER TABLE loans ADD COLUMN bank_name TEXT DEFAULT '';
ALTER TABLE loans ADD COLUMN agency TEXT DEFAULT '';
ALTER TABLE loans ADD COLUMN loan_number TEXT DEFAULT '';
ALTER TABLE loans ADD COLUMN first_payment_date TEXT DEFAULT '';
ALTER TABLE loans ADD COLUMN payment_day INTEGER NOT NULL DEFAULT 25;
ALTER TABLE loans ADD COLUMN total_payments INTEGER NOT NULL DEFAULT 0;
ALTER TABLE loans ADD COLUMN paid_payments INTEGER NOT NULL DEFAULT 0;
