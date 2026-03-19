-- Montant exact facturé par la banque (peut différer du calcul)
ALTER TABLE loan_schedule ADD COLUMN paid_amount INTEGER DEFAULT NULL;
