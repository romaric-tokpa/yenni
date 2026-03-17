-- Migration 005: user_id sur expenses (multi-utilisateurs)
ALTER TABLE expenses ADD COLUMN user_id INTEGER REFERENCES users(id);
