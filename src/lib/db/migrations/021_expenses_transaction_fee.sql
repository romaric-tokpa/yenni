-- Migration 021: Frais de transaction pour mobile money et cartes
ALTER TABLE expenses ADD COLUMN transaction_fee REAL DEFAULT 0;
