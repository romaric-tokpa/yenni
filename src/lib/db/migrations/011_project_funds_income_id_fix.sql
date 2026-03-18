-- Migration 011: Ajout income_id sur project_funds si manquant (fix déploiement)
-- Certaines bases Turso peuvent avoir sauté la migration 003
ALTER TABLE project_funds ADD COLUMN income_id INTEGER DEFAULT NULL;
