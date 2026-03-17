-- Migration 008: Lien dépense/revenu <-> paiement prêt (prêts personnels)
ALTER TABLE loan_payments ADD COLUMN expense_id INTEGER;
ALTER TABLE loan_payments ADD COLUMN income_id INTEGER;
