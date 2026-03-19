-- Migration 017: Migrer les envies existantes vers les listes d'envies
INSERT INTO wish_lists (name, scheduled_date)
SELECT 'Envies', COALESCE((SELECT MIN(target_date) FROM wishes), date('now'))
WHERE EXISTS (SELECT 1 FROM wishes LIMIT 1);

INSERT INTO wish_list_items (list_id, name, target_date, estimated_amount, actual_amount, category, subcategory, notes, status, expense_id, purchased_at)
SELECT (SELECT id FROM wish_lists WHERE name='Envies' ORDER BY id DESC LIMIT 1), name, target_date, estimated_amount, actual_amount, category, subcategory, COALESCE(notes,''), status, expense_id,
  CASE WHEN status='purchased' THEN datetime('now') ELSE NULL END
FROM wishes
WHERE EXISTS (SELECT 1 FROM wish_lists WHERE name='Envies' LIMIT 1);
