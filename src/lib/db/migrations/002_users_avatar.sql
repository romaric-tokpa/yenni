-- Migration 002: avatar_path sur users (ignore si existe déjà)
-- SQLite ne supporte pas IF NOT EXISTS pour ADD COLUMN, le runner gère l'erreur
ALTER TABLE users ADD COLUMN avatar_path TEXT DEFAULT NULL;
