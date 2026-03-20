-- Migration 020: Ajout payment_method si manquant (fix migration 019)
ALTER TABLE expenses ADD COLUMN payment_method TEXT DEFAULT 'cash';
