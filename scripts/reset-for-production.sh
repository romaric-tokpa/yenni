#!/bin/bash
# Réinitialise les données pour un déploiement en production propre.
# Supprime la base SQLite, les sauvegardes et les avatars de développement.

set -e
cd "$(dirname "$0")/.."

echo "🗑️  Suppression des données de développement..."

# Base de données
rm -f data/budget.db data/budget.db-shm data/budget.db-wal 2>/dev/null || true

# Sauvegardes
rm -f data/last_auto_backup.txt 2>/dev/null || true
rm -rf data/backups/* 2>/dev/null || true

# Avatars (data et public)
rm -rf data/uploads/avatars/* 2>/dev/null || true
rm -rf public/uploads/avatars/* 2>/dev/null || true

echo "✅ Données supprimées. La base sera recréée vide au prochain démarrage."
echo ""
echo "Pour Docker : docker compose down -v && docker compose up -d"
echo "  (-v supprime les volumes pour repartir à zéro)"
