# Yenni (MonBudget) — Documentation produit & technique

Ce document décrit **l’application**, sa **logique métier**, les **fonctionnalités**, les **parcours utilisateur** et des **user stories** représentatives. Il sert de référence pour l’équipe, les contributions et l’onboarding.

---

## 1. Vision & positionnement

**Yenni** est une application web de **gestion budgétaire personnelle** orientée :

- **Franc CFA (FCFA)** et usage **mobile** (PWA possible).
- **Budget par catégories** avec exercice **mois par mois**.
- **Trésorerie multi-comptes** (espèces, mobile money, banques, coffres) avec **soldes calculés** à partir des opérations.
- Modules complémentaires : **épargne**, **projets**, **prêts / dettes**, **envies & listes de courses**, **charges fixes**, **calendrier** et **historique**.

L’objectif : permettre à un utilisateur de **voir où va son argent**, de **respecter un plan**, et de **suivre ses comptes réels** sans confondre « budget » et « solde bancaire ».

---

## 2. Stack technique

| Couche | Technologies |
|--------|----------------|
| Framework | **Next.js** (App Router), **React 19** |
| Styles | **Tailwind CSS** |
| Données | **SQLite** (local via `better-sqlite3`) ou **Turso** (`@libsql/client`) selon l’environnement |
| Auth | Sessions **JWT** (cookies), mots de passe hashés (**bcryptjs**) |
| API | Routes `src/app/api/**` (REST JSON) |
| État client | **React Context** (`BudgetContext`, `AuthContext`), hook **`useBudget`**, **SWR** (ex. historique) |
| Divers | **date-fns**, **Recharts**, **Framer Motion**, export **PDF** (jspdf / html2canvas) |

### Structure des dossiers (simplifié)

```
src/
  app/                 # Pages Next + routes API
    (app)/             # Shell connecté (sidebar, bottom nav, budget)
    (auth)/            # Login, inscription
  components/          # UI métier (Dashboard, ExpenseTracker, Settings, …)
  contexts/            # BudgetContext, AuthContext
  hooks/useBudget.ts   # Chargement agrégé : config, dépenses, comptes, prêts, …
  lib/
    db.ts              # Accès BDD, migrations, logique serveur
    types.ts           # Modèles TypeScript
    constants.ts       # Labels, formats CFA, règles coffre, etc.
```

---

## 3. Concepts métier fondamentaux

### 3.1 Budget vs trésorerie

- **Budget** : enveloppes par **catégorie** pour un **mois / année** donnés (configuration utilisateur + dépenses enregistrées).
- **Trésorerie** : **comptes** avec **solde calculé** = solde initial + revenus affectés au compte − dépenses − transferts sortants (+ transferts entrants, etc.).

Indicateurs clés (dashboard / navigation) :

- **Solde disponible** : somme des soldes **espèces** (`cash`) + **mobile money** uniquement (comptes non archivés) — base du **budget / jour** dans la barre latérale et la nav mobile.
- **Actifs** (carte tableau de bord) : **somme des soldes** de tous les comptes **non archivés** uniquement. Les **entrées du mois** ne sont pas ajoutées en plus : elles sont déjà comptées dans les soldes via les comptes de versement.
- **Solde net (mois)** : toujours **flux uniquement** = ces mêmes entrées du mois moins les sorties budgétées (charges, dépenses variables, épargne du mois, fonds projet, remboursements de prêts).

Une **dépense** ou un **revenu** peut être rattaché à un **`account_id`** : cela **impacte le solde** du compte et les agrégats du mois.

### 3.2 Comptes (`Account`)

Types principaux (voir `ACCOUNT_KIND_PRESETS` dans le code) : espèces, mobile money, cartes prépayées, comptes bancaires (livret, courant…), **coffre-fort** (`vault`), autre.

- **Coffre** : période de **verrouillage** : entrées autorisées, sorties (achats, transferts sortants) bloquées jusqu’à une date ou **déblocage manuel**.
- **Transferts entre comptes** : déplacent la trésorerie **sans** traiter comme une dépense budgétaire.

#### Comptabilité stricte (soldes)

- **Source de vérité** : `src/lib/account-balance.ts` agrège solde initial + revenus − dépenses (avec frais) − charges fixes payées − achats projet (sans dépense liée) − paiements de prêt « orphelins » + encaissements prêt fait orphelins ± transferts (dont frais éventuels sur un compte tiers `fees_account_id`).
- **Migrations** : `031_strict_accounts.sql` ajoute `account_id` sur les paiements (charges fixes, prêts, achats projet, dépenses planifiées, etc.) et `fees_account_id` sur les transferts ; données existantes sont rattachées aux comptes quand c’est possible.
- **API** : les créations de mouvements exigent un **`account_id`** valide là où la trésorerie est impactée ; `GET /api/accounts/balances` renvoie les soldes recalculés.

### 3.3 Configuration budget (`BudgetConfig`)

Catégories, charges fixes, salaire mensuel (réglages), types de revenu à la saisie (Freelance, Don, Commissions, etc.), projets, fonds d’urgence (dont lien possible vers un compte coffre), logo app, etc.

### 3.4 Prêts

Prêts avec **échéancier**, paiements, rattachement possible à des **comptes** pour équilibre trésorerie ; notifications / rappels selon l’implémentation (cloche).

---

## 4. Fonctionnalités par module

| Zone | Route(s) | Rôle |
|------|-----------|------|
| **Accueil** | `/dashboard` | Synthèse : soldes, alertes, raccourcis, cartes comptes |
| **Transactions** | `/transactions` | Saisie / liste des dépenses & revenus (compte, catégorie, frais…) |
| **Budget** | `/budget` | Vue catégories, reste à vivre, pilotage du mois |
| **Calendrier** | `/calendar` | Vue temporelle des dépenses / événements liés au budget |
| **Épargne** | `/savings` | Objectifs d’épargne, fonds d’urgence (dont coffre) |
| **Envies** | `/wishes` | Listes de souhaits, catégories, achats liés |
| **Courses** | `/shopping-lists` | Listes de courses |
| **Prêts** | `/loans`, `/loans/new`, `/loans/[id]/edit` | Emprunts, échéances, paiements |
| **Projets** | `/projects` | Épargne projetée, poche compte, versements |
| **Historique** | `/history` | Historique consolidé (cache SWR) |
| **Réglages** | `/settings` | Profil, préférences, salaires, charges, catégories envies, lien vers trésorerie |
| **Trésorerie** | `/settings/accounts` | Liste des comptes, transferts, archivage, suppression |
| **Compte — mouvements** | `/settings/accounts/[id]` | Fil des opérations du compte |
| **Compte — création / édition** | `/settings/accounts/new`, `.../[id]/edit` | Formulaire compte |
| **Auth** | `/login`, `/register` | Connexion / inscription |
| **Dépenses (alias)** | `/expenses` | Redirection ou variante UX vers la saisie |

**Navigation**

- **Desktop** : sidebar (`Sidebar.tsx`).
- **Mobile** : barre du bas + feuille « Plus » (`BottomNav.tsx`).

---

## 5. Parcours utilisateur (parcours types)

### 5.1 Nouvel utilisateur

1. Atterrissage sur `/` → redirection vers `/login` ou `/dashboard` si déjà connecté.
2. Inscription → connexion → chargement du **BudgetProvider** (config, mois courant, comptes par défaut si prévus).
3. Découverte : **Accueil** → **Réglages** pour renseigner revenus / catégories → **Transactions** pour première saisie.

### 5.2 Saisie du quotidien

1. Ouvre **Transactions** (ou raccourci depuis le dashboard).
2. Ajoute une **dépense** : montant, catégorie, **compte** de paiement, éventuels frais.
3. Le **solde du compte** et les **totaux du mois** se mettent à jour (via `fetchAccounts` + révisions — voir synchro).

### 5.3 Gestion des comptes

1. **Réglages** → **Trésorerie** (`/settings/accounts`).
2. Création / édition / archivage / suppression (selon règles métier : ex. compte encore utilisé).
3. **Transfert** entre deux comptes depuis la même page.
4. Détail **Mouvements** par compte pour audit.

### 5.4 Pilotage budgétaire mensuel

1. Choisir mois / année dans les vues concernées.
2. **Budget** : comparer budget catégorie vs dépensé.
3. **Calendrier** : répartition dans le temps.
4. Ajuster **épargne** ou **projets** si besoin.

### 5.5 Prêt avec échéances

1. **Prêts** → création, saisie échéancier.
2. Paiement d’échéance (potentiellement lié à un compte).
3. Suivi du capital restant dans les écrans prêts + notifications si activées.

---

## 6. User stories (backlog de référence)

Formulation classique : *En tant que … je veux … afin de …*.

### Authentification & profil

- **US-A1** — En tant qu’**utilisateur**, je veux **me connecter avec email / mot de passe** afin d’**accéder à mes données de façon sécurisée**.
- **US-A2** — En tant qu’**utilisateur**, je veux **modifier mon profil / avatar** afin de **personnaliser l’application**.

### Transactions & budget

- **US-T1** — En tant qu’**utilisateur**, je veux **enregistrer une dépense en FCFA avec catégorie et compte** afin de **voir mon budget et ma trésorerie à jour**.
- **US-T2** — En tant qu’**utilisateur**, je veux **enregistrer un revenu** afin de **créditer un compte et compléter mon mois**.
- **US-T3** — En tant qu’**utilisateur**, je veux **voir mon reste à vivre / budget par jour** afin de **m’ajuster avant la fin du mois**.

### Comptes & trésorerie

- **US-C1** — En tant qu’**utilisateur**, je veux **créer plusieurs comptes** (Wave, banque, espèces…) afin de **refléter ma réalité**.
- **US-C2** — En tant qu’**utilisateur**, je veux **modifier ou archiver un compte** afin de **corriger ou ranger** sans perdre l’historique si les règles le permettent.
- **US-C3** — En tant qu’**utilisateur**, je veux **transférer de l’argent entre comptes** afin de **ne pas confondre avec une dépense budgétaire**.
- **US-C4** — En tant qu’**utilisateur**, je veux **voir les mouvements d’un compte** afin de **justifier un solde**.

### Épargne, projets, envies

- **US-E1** — En tant qu’**utilisateur**, je veux **définir une épargne ou un projet** avec objectif afin de **mettre de côté de façon structurée**.
- **US-W1** — En tant qu’**utilisateur**, je veux **tenir une liste d’envies / courses** afin de **planifier des achats sans oublis**.

### Prêts

- **US-L1** — En tant qu’**utilisateur**, je veux **enregistrer un prêt et son échéancier** afin de **visualiser les mensualités**.
- **US-L2** — En tant qu’**utilisateur**, je veux **marquer une échéance comme payée** afin de **garder un historique fiable**.

*(Les user stories peuvent être découpées en tickets plus petits côté dev / QA.)*

---

## 7. Synchronisation des données (UX « temps réel » côté client)

Sans WebSocket : l’app s’appuie sur :

- **`fetchAccounts`** après les opérations qui touchent aux soldes.
- Un compteur **`accountsRevision`** incrémenté après rechargements des comptes (hors premier chargement), pour **rafraîchir** par ex. la page **Mouvements** d’un compte.
- **`BroadcastChannel`** pour **synchroniser plusieurs onglets**.
- **`visibilitychange`** pour **recharger les comptes** au retour sur l’onglet.

---

## 8. API & persistance (logique côté serveur)

- Les routes **`/api/*`** valident la session (`getSessionFromCookies`) quand nécessaire.
- **`src/lib/db.ts`** concentre migrations, requêtes, et règles (ex. suppression de compte, soldes, prêts).
- Les types dans **`src/lib/types.ts`** alignent le **contrat** JSON avec le front.

---

## 9. Contraintes & règles métier à connaître (non exhaustif)

- Suppression d’un **compte** souvent **bloquée** si des dépenses, revenus ou transferts y sont encore liés (message invitant à archiver ou réaffecter).
- **Dernier compte** : typiquement non supprimable.
- **Coffre** : respect du verrou pour les sorties (débits) ; exceptions via **déblocage** selon l’UI.
- Montants en **entiers FCFA** arrondis côté API sur plusieurs opérations.

---

## 10. Évolutions possibles (idées)

- Import relevé bancaire / catégorisation automatique.
- Rappels push (nécessite service worker / backend dédié).
- Multi-devises (au-delà du CFA).
- Rôles / partage de budget en foyer.

---

## 11. Maintenance de ce document

- **Tenir à jour** lors d’ajout de route majeure, changement de flux auth, ou nouvelle entité métier.
- Référence rapide des titres de page : `src/lib/pageTitles.ts`.

---

*Document généré pour le dépôt **monbudget** (Yenni) — à adapter au fil des releases.*
