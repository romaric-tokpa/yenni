-- Migration 031: Comptabilité stricte — account_id sur toutes les transactions + frais transfert optionnels
-- Les erreurs duplicate column sont ignorées par le runner (db.ts).

ALTER TABLE fixed_charge_payments ADD COLUMN account_id INTEGER NOT NULL DEFAULT 0;
ALTER TABLE loan_payments ADD COLUMN account_id INTEGER NOT NULL DEFAULT 0;
ALTER TABLE project_purchases ADD COLUMN account_id INTEGER NOT NULL DEFAULT 0;
ALTER TABLE savings ADD COLUMN account_id INTEGER NOT NULL DEFAULT 0;
ALTER TABLE planned_expenses ADD COLUMN account_id INTEGER NOT NULL DEFAULT 0;
ALTER TABLE project_funds ADD COLUMN account_id INTEGER NOT NULL DEFAULT 0;
ALTER TABLE account_transfers ADD COLUMN fees_account_id INTEGER DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_account ON expenses(account_id);
CREATE INDEX IF NOT EXISTS idx_incomes_account ON incomes(account_id);
CREATE INDEX IF NOT EXISTS idx_fcp_account ON fixed_charge_payments(account_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_account ON loan_payments(account_id);
CREATE INDEX IF NOT EXISTS idx_project_funds_account ON project_funds(account_id);
CREATE INDEX IF NOT EXISTS idx_project_purchases_account ON project_purchases(account_id);
CREATE INDEX IF NOT EXISTS idx_savings_account ON savings(account_id);
CREATE INDEX IF NOT EXISTS idx_planned_expenses_account ON planned_expenses(account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_fees_acct ON account_transfers(fees_account_id);

UPDATE project_funds SET account_id = from_account_id WHERE account_id = 0 AND from_account_id IS NOT NULL AND from_account_id > 0;

UPDATE expenses SET account_id = COALESCE(
  (SELECT a.id FROM accounts a WHERE a.user_id = expenses.user_id ORDER BY a.is_archived ASC, a.sort_order ASC, a.id ASC LIMIT 1),
  account_id
) WHERE (account_id IS NULL OR account_id = 0) AND user_id IS NOT NULL;

UPDATE incomes SET account_id = COALESCE(
  (SELECT a.id FROM accounts a ORDER BY a.is_archived ASC, a.sort_order ASC, a.id ASC LIMIT 1),
  account_id
) WHERE account_id IS NULL OR account_id = 0;

UPDATE fixed_charge_payments SET account_id = COALESCE(
  (SELECT a.id FROM accounts a ORDER BY a.is_archived ASC, a.sort_order ASC, a.id ASC LIMIT 1),
  0
) WHERE account_id = 0 OR account_id IS NULL;

UPDATE loan_payments SET account_id = COALESCE(
  (SELECT e.account_id FROM expenses e WHERE e.id = loan_payments.expense_id),
  (SELECT i.account_id FROM incomes i WHERE i.id = loan_payments.income_id),
  account_id
) WHERE (account_id = 0 OR account_id IS NULL) AND (expense_id IS NOT NULL OR income_id IS NOT NULL);
