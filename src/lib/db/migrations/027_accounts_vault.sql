-- Coffre : aucune sortie (dépense / transfert depuis ce compte) avant cette date (YYYY-MM-DD) ou déblocage manuel (NULL).
ALTER TABLE accounts ADD COLUMN vault_unlocks_on TEXT;
