-- Logo opérateur (data URI image) ; les comptes espèces / banque utilisent seulement `icon`
ALTER TABLE accounts ADD COLUMN logo_url TEXT NOT NULL DEFAULT '';
