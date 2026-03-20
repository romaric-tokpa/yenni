-- Compte de prélèvement des remboursements / compte par défaut pour encaissements (prêt à un proche)
ALTER TABLE loans ADD COLUMN payment_account_id INTEGER;
