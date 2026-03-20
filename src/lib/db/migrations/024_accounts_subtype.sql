-- Sous-type de compte (ex. opérateur Mobile Money : wave, orange_money…)
ALTER TABLE accounts ADD COLUMN subtype TEXT NOT NULL DEFAULT '';
