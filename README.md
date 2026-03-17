This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Base de données : Turso (production) ou SQLite locale (développement)

L'application utilise **Turso** (SQLite hébergé) pour la production sur Vercel, et **SQLite locale** (`data/budget.db`) en développement.

### Configuration Turso (Vercel)

1. Créez une base sur [turso.tech](https://turso.tech)
2. Récupérez l’URL et le token d’authentification
3. Ajoutez ces variables d’environnement sur Vercel :
   - `TURSO_DATABASE_URL` : URL de la base (ex. `libsql://votre-db-votre-org.turso.io`)
   - `TURSO_AUTH_TOKEN` : Token d’authentification

Sans ces variables, l’app utilise une base SQLite locale (`data/budget.db`).

### Migrations

Les migrations sont dans `src/lib/db/migrations/` et s’exécutent automatiquement au démarrage.

## Mise en production

Avant de déployer en local, réinitialiser les données de développement :

```bash
./scripts/reset-for-production.sh
```

Sur Vercel, les données sont stockées dans Turso et persistent entre les déploiements.

## Docker

Démarrer l'application avec Docker :

```bash
# Build et lancement
docker compose up -d

# ou build puis run
docker compose build
docker compose up -d
```

L'application est accessible sur [http://localhost:3000](http://localhost:3000).

Les données (base SQLite, sauvegardes, avatars) sont persistées dans des volumes Docker.

### Commandes utiles

```bash
docker compose up -d      # Démarrer en arrière-plan
docker compose down       # Arrêter
docker compose down -v    # Arrêter et supprimer les volumes (reset complet)
docker compose logs -f    # Voir les logs
```

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
