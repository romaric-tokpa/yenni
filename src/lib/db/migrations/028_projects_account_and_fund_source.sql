-- Migration 028: compte d’épargne par projet + compte source pour chaque versement
ALTER TABLE projects ADD COLUMN account_id INTEGER DEFAULT NULL;
ALTER TABLE project_funds ADD COLUMN from_account_id INTEGER DEFAULT NULL;
