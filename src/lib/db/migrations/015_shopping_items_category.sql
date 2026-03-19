-- Migration 015: Catégorie pour les articles de liste de courses
ALTER TABLE shopping_list_items ADD COLUMN category TEXT NOT NULL DEFAULT 'food';
