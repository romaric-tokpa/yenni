-- Plus de blocage des sorties par date : nettoyer les anciennes échéances stockées.
UPDATE accounts SET vault_unlocks_on = NULL WHERE vault_unlocks_on IS NOT NULL;
