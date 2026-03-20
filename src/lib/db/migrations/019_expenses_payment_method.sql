-- Migration 019: Mode de paiement pour les dépenses
ALTER TABLE expenses ADD COLUMN payment_method TEXT DEFAULT 'cash';
