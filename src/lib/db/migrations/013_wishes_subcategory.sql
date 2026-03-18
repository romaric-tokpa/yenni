-- Migration 013: Sous-catégories pour les envies
ALTER TABLE wishes ADD COLUMN subcategory TEXT;
