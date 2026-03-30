-- Migration 035: Jeu unique de types de compte (aligné sur les presets actuels).
-- Anciens kinds → nouveaux : vault → bank_blocked_savings, prepaid_card → mobile_money,
-- bank_loan → bank_current, other → cash.

UPDATE accounts SET kind = 'bank_blocked_savings' WHERE kind = 'vault';

UPDATE accounts SET kind = 'mobile_money' WHERE kind = 'prepaid_card';

UPDATE accounts SET subtype = 'other' WHERE kind = 'mobile_money' AND subtype IN ('djamo', 'push');

UPDATE accounts SET kind = 'bank_current' WHERE kind = 'bank_loan';

UPDATE accounts SET kind = 'cash' WHERE kind = 'other';
