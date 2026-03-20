-- Photos d'article (URLs data:image en JSON)
ALTER TABLE wish_list_items ADD COLUMN photos_json TEXT NOT NULL DEFAULT '[]';
