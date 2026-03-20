-- Nom de l’établissement (ex. banque) pour les comptes bancaires
ALTER TABLE accounts ADD COLUMN institution_name TEXT NOT NULL DEFAULT '';
