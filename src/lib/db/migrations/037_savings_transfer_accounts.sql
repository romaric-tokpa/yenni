-- Migration 037 : comptes débit / crédit pour chaque ligne d'épargne mensuelle

ALTER TABLE savings ADD COLUMN from_account_id INTEGER;
ALTER TABLE savings ADD COLUMN to_account_id INTEGER;
