-- Migration 003: income_id sur project_funds
ALTER TABLE project_funds ADD COLUMN income_id INTEGER DEFAULT NULL;
