-- Migration 007: Lien dépense <-> échéance pour synchronisation bidirectionnelle
ALTER TABLE loan_schedule ADD COLUMN expense_id INTEGER;
