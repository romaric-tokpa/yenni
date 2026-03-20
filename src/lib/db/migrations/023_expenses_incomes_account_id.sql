-- Migration 023: Liaison dépenses / revenus ↔ compte
ALTER TABLE expenses ADD COLUMN account_id INTEGER REFERENCES accounts(id);
ALTER TABLE incomes ADD COLUMN account_id INTEGER REFERENCES accounts(id);
