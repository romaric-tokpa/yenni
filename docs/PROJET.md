# Yenni (MonBudget) — Guide complet du produit

Ce document décrit **tout ce que fait l’application** : pour **les utilisateurs** et les personnes **non techniques** (en langage clair), ainsi qu’une **annexe technique** pour les développeurs et l’onboarding.

---

## Sommaire

1. [En bref](#1-en-bref)
2. [Pour qui ? À quoi ça sert ?](#2-pour-qui--à-quoi-ça-sert-)
3. [Lexique simple](#3-lexique-simple)
4. [Toutes les fonctionnalités, écran par écran](#4-toutes-les-fonctionnalités-écran-par-écran)
5. [Actions rapides et fenêtres « modales »](#5-actions-rapides-et-fenêtres-modales)
6. [Indicateurs, rapports et exports](#6-indicateurs-rapports-et-exports)
7. [Notifications et rappels](#7-notifications-et-rappels)
8. [Sauvegardes de tes données](#8-sauvegardes-de-tes-données)
9. [Application mobile & mode hors ligne](#9-application-mobile--mode-hors-ligne)
10. [Parcours types (du premier jour au suivi mensuel)](#10-parcours-types)
11. [Règles importantes (comptes, coffre, suppressions)](#11-règles-importantes)
12. [Annexe technique (équipe produit / dev)](#12-annexe-technique-équipe-produit--dev)
13. [Évolutions possibles](#13-évolutions-possibles)
14. [Maintenance de ce document](#14-maintenance-de-ce-document)

---

## 1. En bref

**Yenni** est une **application web de gestion d’argent personnel**. Elle est pensée pour l’**Afrique de l’Ouest** : les montants sont en **francs CFA (FCFA)**.

Tu peux avec Yenni :

- **Voir** combien tu gagnes, combien tu dépenses et **où** part ton argent (par catégorie).
- **Suivre plusieurs comptes** réels : espèces, Mobile Money, banque, cartes, coffre… avec des **soldes calculés** automatiquement à partir de ce que tu enregistres.
- **Planifier** : budget par catégorie, charges fixes du mois, épargne, projets (vacances, gros achat…), prêts et dettes.
- **Noter** chaque dépense et chaque revenu, **transférer** de l’argent d’un compte à l’autre (sans le confondre avec une dépense « shopping »).
- Consulter des **indicateurs** (graphiques, historique), exporter en **CSV** ou **PDF**, et **sauvegarder** ou **restaurer** toutes tes données.

> **En une phrase** : Yenni t’aide à **ne pas confondre** « ce que je peux dépenser ce mois-ci » (budget) et « ce qu’il y a sur mon compte Wave » (trésorerie), tout en gardant **une seule vision** de tes finances.

---

## 2. Pour qui ? À quoi ça sert ?

- **Particuliers** qui veulent maîtriser leur budget mensuel sans tableur compliqué.
- Personnes avec **plusieurs moyens de paiement** (liquide + téléphone + banque).
- Ceux qui ont des **charges fixes** (loyer, abonnements), des **objectifs d’épargne**, des **prêts** à rembourser ou des **projets** à financer.
- Usage **sur téléphone** (navigation adaptée) ou **sur ordinateur** (menu latéral).

Ce n’est **pas** un logiciel bancaire officiel : Yenni **ne se connecte pas** à ta banque automatiquement. **Toi**, tu saisis les mouvements ; l’app **recalcule** les soldes et les totaux.

---

## 3. Lexique simple

| Terme | Explication simple |
|--------|-------------------|
| **Budget (par catégorie)** | Enveloppe d’argent que tu te fixes pour un type de dépense (nourriture, transport…) **pour un mois donné**. |
| **Dépense variable** | Achat du quotidien que tu enregistres (restaurant, essence…) ; il diminue ton enveloppe et le solde du compte utilisé. |
| **Charge fixe** | Dépense **récurrente** du mois (loyer, internet…) ; tu peux la payer depuis un compte précis. |
| **Revenu** | Argent qui **entre** (salaire saisi à part, primes, dons…) et qui **crédite** le compte choisi. |
| **Compte (trésorerie)** | Représente un **endroit où est ton argent** : poche espèces, Wave, compte banque, coffre, etc. Chaque compte a un **solde** recalculé par l’app. |
| **Transfert entre comptes** | Tu déplaces de l’argent d’un compte vers un autre (ex. retrait banque → espèces). Ce n’est **pas** une dépense « consommation » : ça ne casse pas ton budget courses. |
| **Coffre / verrou** | Type de compte où tu peux **bloquer les sorties** jusqu’à une date (épargne « forcée »). |
| **Prêt / dette** | Emprunt ou argent prêté avec **échéancier** ; les paiements peuvent être liés à un compte. |
| **Projet** | Objectif d’épargne **dédié** (avec éventuellement un compte lié et des versements). |
| **Solde disponible (liquide)** | Souvent : **espèces + Mobile Money** — utilisé pour le **« budget par jour »** affiché dans le menu (jusqu’à la fin du mois). |
| **Indicateurs** | Écran d’**analyse** : graphiques, filtres par période, vue d’ensemble de tout l’historique. |

Couleurs courantes dans l’interface : **rouge** pour les dépenses / sorties d’argent, **vert** pour les revenus, **orange** pour les transferts entre comptes (pour les repérer vite).

---

## 4. Toutes les fonctionnalités, écran par écran

L’application se compose de **zones de navigation** : sur grand écran, un **menu à gauche** ; sur téléphone, une **barre en bas** avec accès rapide aux principales pages.

### 4.1 Page d’accueil du site (`/`)

- Si tu es **déjà connecté** → redirection vers le **tableau de bord**.
- Sinon → vers **Connexion**.
- Si la connexion échoue, une **page d’accueil marketing** simple propose **Créer un compte** ou **Se connecter**, avec trois idées : revenus, charges fixes, budgets.

### 4.2 Connexion & inscription (`/login`, `/register`)

- Création de compte avec **email** et **mot de passe**.
- Connexion ; déconnexion possible depuis le menu utilisateur.
- **Profil** : nom, prénom, téléphone, **photo de profil** (avatar) modifiables.

### 4.3 Accueil — Tableau de bord (`/dashboard`)

Synthèse du mois (et de ta situation « à date ») :

- **Salutation** et rappel du **mois budgétaire** sélectionné.
- **Période pour la trésorerie** : tu peux afficher les soldes des comptes pour **le mois en cours**, un **trimestre**, une **année**, ou une **plage de dates** personnalisée (solde « comme à cette date »).
- **Actions rapides** : liens pour **Dépense**, **Revenu**, **Transfert** (souvent sous forme de fenêtre dédiée, voir §5).
- **Bloc salaire** : rappel du **salaire du mois** (saisi dans les réglages) — pilote en partie le reste du budget.
- **Cartes des comptes** : aperçu des **soldes** (selon la période trésorerie choisie).
- **Indicateurs clés (KPI)** : par exemple actifs totaux, passifs / sorties du mois, solde disponible (liquide), épargne cumulée — avec textes d’aide.
- **Mini-indicateurs** : taux d’endettement, taux d’épargne, **dépensé ce mois**, solde net du mois, dette restante.
- **Budget par catégorie** : liste **repliable** : pour chaque catégorie, combien tu as **budgétisé**, combien tu as **dépensé**, barre de progression.
- **Graphiques** : par ex. **revenus vs dépenses** sur l’année.
- **Export PDF** du bilan (selon mise en œuvre actuelle).

### 4.4 Transactions (`/transactions`)

Le **cœur du quotidien** :

- Liste de **toutes les opérations** du mois : dépenses variables, charges fixes payées, revenus saisis, transferts.
- **Filtres** par type (tout, dépenses seules, revenus, transferts…).
- **Deux vues** : liste continue ou **regroupement par jour** avec totaux du jour (sorties en rouge, entrées en vert, volume des transferts en orange).
- **Synthèse en haut** : totaux du mois (dépenses variables, fixes, total sorties, revenus, volume transferts, reste sur budget variable…).
- **Ajouter** une dépense (souvent via bouton ou **modale**).
- **Modifier / supprimer** une ligne (selon les règles).
- **Exporter** le mois en **CSV**.
- **Dépenses planifiées** : liste des achats à venir avec dates ; exécution possible depuis ici ou via les notifications.
- Section **historique** des dépenses variables sur **autres périodes** (comparaison / audit).

### 4.5 Budget (`/budget`)

- Vue par **catégorie** : plafond mensuel, **déjà dépensé**, pourcentage, signal visuel si tu dépasses.
- Tu peux **ajuster** les montants budgétés (selon les réglages).

### 4.6 Calendrier (`/calendar`)

- **Grille du mois** : chaque jour peut montrer un **résumé** entrées / sorties.
- **Clic sur un jour** : détail des événements, totaux **revenus** / **dépenses** du jour.
- **Ajout rapide** d’une dépense ou d’un revenu **à cette date**.
- **Résumé du mois** en haut (actifs, revenus, charges fixes, prêts, dépenses variables, liquidité…).

### 4.7 Épargne (`/savings`)

- Objectifs d’épargne (dont **fonds d’urgence**).
- Saisie / suivi de l’épargne **mois par mois** et **cumul**.
- Lien possible avec un **compte coffre** pour le fonds d’urgence.
- Période d’objectif (dates de début / fin) pour suivre la progression.

### 4.8 Envies (`/wishes`)

- **Listes de souhaits** (ex. équipement, cadeaux).
- Articles avec montants, statuts ; **achat** peut être enregistré et lié à la trésorerie (selon flux).
- **Modales** pour créer liste, article, ou enregistrer un achat.

### 4.9 Courses — listes de shopping (`/shopping-lists`)

- Plusieurs **listes** (ex. supermarché, marché).
- **Articles** à cocher, montants ; possibilité d’**enregistrer un achat** rattaché à un compte / catégorie.
- Modales pour nouvelle liste, nouvel article, achat.

### 4.10 Prêts & dettes (`/loans`, `/loans/new`, `/loans/[id]/edit`)

- Liste des **prêts** : emprunts ou argent prêté à quelqu’un (**récupération**).
- Création avec **échéancier** (génération / régénération possible selon règles).
- **Paiements** d’échéances, montant, compte, frais éventuels.
- **Capital restant**, historique, notifications liées aux échéances (voir §7).

### 4.11 Projets (`/projects`)

- **Projets** d’épargne (vacances, véhicule…).
- **Fonds** versés sur le projet (et parfois **achats** liés au projet).
- Suivi des montants **objectif vs épargné**.

### 4.12 Indicateurs (`/history`)

*(Le titre dans le menu peut être « Indicateurs » ; ce n’est pas seulement une « liste passée », c’est surtout une **vue analytique**.)*

- **Période** : jour, mois, trimestre, semestre, année.
- **Filtres** par type de mouvement : dépenses, revenus, charges fixes, prêts, épargne, projets, planifiées, envies, courses…
- **Graphiques** : barres (revenus / dépenses), **répartition** des dépenses, **mix des revenus**, **flux net** dans le temps.
- **Tableau détaillé** des opérations unifiées.
- **Exports CSV et PDF** de l’historique filtré.
- Données chargées via le serveur avec **mise en cache** côté navigateur pour la fluidité.

### 4.13 Réglages (`/settings`)

- **Profil** et **sécurité** : mot de passe, avatar.
- **Lien** vers la **Trésorerie** (comptes) — carte dédiée en haut de page.
- **Configuration du budget** : catégories de dépenses, **charges fixes** du mois, **salaires** (mois par mois, compte de versement), types de revenus, **projets** en config, **logo** de l’app (affichage), paramètres d’objectifs d’épargne, etc.
- **Sauvegardes** : export JSON complet, import, liste des sauvegardes automatiques (voir §8).

### 4.14 Trésorerie — comptes (`/settings/accounts`)

- **Liste** de tous les comptes avec **soldes** (et choix d’une **date limite** pour le calcul des soldes, si prévu).
- **Création** (`/settings/accounts/new`) : nom, type (espèces, Mobile Money, banque, coffre…), couleur, logo, solde d’ouverture, ordre d’affichage, date de déverrouillage pour coffre…
- **Édition** d’un compte.
- **Archivage** pour retirer un compte des vues courantes sans tout perdre (selon règles).
- **Transferts** entre comptes (montant, **frais** éventuels payés sur un compte « frais »).
- **Historique récent** des transferts depuis cette page.
- **Suppression** d’un compte (si **aucune opération** ne pointe encore dessus ; sinon message d’erreur explicite).

### 4.15 Mouvements d’un compte (`/settings/accounts/[id]`)

- **Fil du temps** : dépenses, revenus et transferts **affectant ce compte**.
- Libellés du type « Transfert vers… » / « reçu depuis… » avec **montants** colorés (vert / rouge / orange pour transferts).
- Lien pour **modifier le compte**.

### 4.16 Redirection `/accounts` et `/expenses`

- **`/accounts`** redirige vers **`/settings/accounts`** (trésorerie).
- **`/expenses`** : entrée alternative vers la **saisie de dépenses** (flux prévu pour l’UX).

### 4.17 Hors ligne (`/offline`)

- Page affichée quand la connexion réseau **manque** (souvent en lien avec la **PWA**).

### 4.18 Fenêtre modale globale (`/modal`)

- Page technique servant de **conteneur** pour les formulaires plein écran (voir §5).

---

## 5. Actions rapides et fenêtres « modales »

Plusieurs actions ouvrent une **route dédiée** du type `/modal?type=…&returnTo=…` puis reviennent à la page d’origine :

| Type | Rôle |
|------|------|
| **Nouvelle dépense** | Montant, date, heure, catégorie, compte, notes, **frais de transaction** si besoin. |
| **Nouveau revenu** | Montant, date, type de revenu, compte de crédit. |
| **Transfert rapide** | Compte source, destination, montant, frais éventuels. |
| **Dépense planifiée** | Programmer une dépense future (date, description, catégorie, compte). |
| **Envies / courses** | Nouvelle liste, nouvel article, enregistrement d’**achat** (panier ou envie). |

Cela permet d’**ajouter une transaction depuis le tableau de bord** (ou ailleurs) sans perdre le contexte.

---

## 6. Indicateurs, rapports et exports

- **Tableau de bord** : export **PDF** du bilan.
- **Transactions** : export **CSV** du mois.
- **Indicateurs** : **CSV** et **PDF** sur la période et les filtres choisis.
- Graphiques **Revenus vs Dépenses**, **camembert** des dépenses, **mix des revenus**, **cash-flow net**.

---

## 7. Notifications et rappels

- **Cloche** dans l’en-tête (sur les grands écrans / layout connecté).
- Affiche une liste de **« choses à faire »** générées côté serveur : par exemple **dépenses planifiées** à valider ou payer, **échéances de prêts**, rappels liés aux **envies** ou **courses** (selon la logique métier en place).
- Tu peux **agir** depuis le panneau (valider une planifiée, aller au prêt…) ou **rafraîchir** la liste.
- Mise à jour **périodique** légère en arrière-plan.

---

## 8. Sauvegardes de tes données

*(Section **Réglages**, en bas de page.)*

- **Exporter** toutes tes données dans un **fichier JSON** (sauvegarde manuelle).
- **Importer / restaurer** un fichier JSON (**écrase** les données actuelles — confirmation nécessaire).
- **Sauvegardes automatiques** : liste téléchargeable par date (selon configuration serveur).

> Pour un utilisateur lambda : pense-y comme une **copie de sécurité** de ton carnet de comptes Yenni, pour changer de téléphone ou éviter une perte accidentelle.

---

## 9. Application mobile & mode hors ligne

- Yenni peut être **installée** sur l’écran d’accueil du téléphone (**PWA** : « Ajouter à l’écran d’accueil » depuis le navigateur).
- Fichiers prévus dans le projet : **manifest**, **service worker** (enregistrement via composants dédiés), **icônes** multiples tailles.
- **Hors ligne** : page dédiée explique l’état ; les **données vivent sur le serveur** qui héberge l’app — sans Internet, les **consultations complètes** ne sont pas garanties (le hors ligne reste un **confort**, pas une synchro cloud native type banque).

---

## 10. Parcours types

### Première utilisation

1. **Créer un compte** ou se connecter.
2. Aller dans **Réglages** : renseigner **salaire**, **charges fixes**, **catégories**, éventuellement créer ses **comptes** dans **Trésorerie**.
3. Enregister une **première dépense** ou **revenu** dans **Transactions**.
4. Consulter l’**Accueil** pour voir les indicateurs se remplir.

### Quotidien

1. **Transactions** ou **raccourci Dépense** depuis l’accueil.
2. Vérifier le **budget par jour** dans le menu (basé sur liquide disponible et jours restants).

### Fin de mois / analyse

1. **Budget** : ajuster le mois suivant.
2. **Indicateurs** : graphes et exports.
3. **Prêts / épargne / projets** : mise à jour des versements.

---

## 11. Règles importantes

- **Transfert** : ne compte pas comme **dépense budgétaire** ; il **déplace** la trésorerie.
- **Coffre verrouillé** : les **sorties** (dépenses, transferts sortants) peuvent être **bloquées** jusqu’à la date ou l’action de déblocage.
- **Suppression de compte** : souvent **impossible** tant qu’il reste des opérations liées ; l’app propose plutôt l’**archivage**.
- **Montants** : stockés et affichés en **FCFA** (entiers).
- **Plusieurs onglets** : les soldes des comptes peuvent se **synchroniser** entre onglets du même navigateur ; retour sur l’app après mise en veille peut **rafraîchir** les comptes.

---

## 12. Annexe technique (équipe produit / dev)

### 12.1 Stack

| Couche | Technologies |
|--------|----------------|
| Framework | **Next.js** (App Router), **React 19** |
| Styles | **Tailwind CSS** |
| Données | **SQLite** (`better-sqlite3`) en local ou **Turso** (`@libsql/client`) selon l’environnement |
| Auth | **JWT** (cookies), **bcryptjs** |
| API | Routes `src/app/api/**` (REST JSON) |
| État client | **React Context** (`BudgetContext`, `AuthContext`), **`useBudget`**, **SWR** (historique / notifications) |
| Divers | **date-fns**, **Recharts**, **Framer Motion**, exports **PDF** (jspdf / html2canvas) |

### 12.2 Structure des dossiers (simplifié)

```
src/
  app/                 # Pages Next.js + routes API
    (app)/             # Layout connecté (sidebar, bottom nav, providers)
    (auth)/            # Login, inscription
  components/          # Vues métier (Dashboard, ExpenseTracker, HistoryView, …)
  contexts/            # BudgetContext, AuthContext
  hooks/useBudget.ts   # Chargement agrégé + mutations budget
  lib/
    db.ts              # Accès BDD, migrations
    account-balance.ts # Calcul des soldes comptes
    types.ts           # Modèles TypeScript
    constants.ts       # Formats CFA, règles coffre, …
```

### 12.3 Liste des routes « pages » principales

| Chemin | Titre UI (voir `pageTitles.ts`) |
|--------|----------------------------------|
| `/dashboard` | Accueil |
| `/transactions` | Transactions |
| `/budget` | Budget |
| `/calendar` | Calendrier |
| `/savings` | Épargne |
| `/wishes` | Envies |
| `/shopping-lists` | Courses |
| `/loans` | Prêts & dettes |
| `/projects` | Projets |
| `/history` | Indicateurs |
| `/settings` | Réglages |
| `/settings/accounts` | Trésorerie |
| `/settings/accounts/new` | Nouveau compte |
| `/settings/accounts/[id]` | Mouvements du compte |
| `/settings/accounts/[id]/edit` | Modifier le compte |

### 12.4 API (aperçu)

Les routes **`/api/*`** valident la session quand nécessaire. Exemples : `auth/*`, `config`, `expenses`, `incomes`, `fixed-charges`, `savings`, `salaries`, `accounts`, `accounts/[id]/transactions`, `account-transfers`, `loans`, `loan-payments`, `loan-schedule`, `projects`, `project-funds-sum`, `planned-expenses`, `category-budgets`, `budget-summary`, `history`, `notifications`, `wish-lists`, `wishes`, `shopping-lists`, `backup`, `backup/auto`, `logo`, etc.

### 12.5 Synchronisation client (sans WebSocket)

- Rechargement des **comptes** après opérations impactant les soldes.
- Compteur **`accountsRevision`** pour propager les mises à jour (ex. vue mouvements d’un compte).
- **`BroadcastChannel`** : synchro entre onglets.
- **`visibilitychange`** : rafraîchissement possible au retour sur l’onglet.

### 12.6 Budget vs trésorerie (rappel technique)

- **Soldes** : logique centralisée (`account-balance`, migrations comptables strictes avec `account_id` / `fees_account_id` sur les flux concernés).
- **Indicateurs** « budget / jour » : basés sur **liquide** (espèces + Mobile Money) et jours restants du **mois budgétaire**.

### 12.7 Performance (chargement)

- Chargement initial du budget : données **critiques** d’abord (config, comptes, flux du mois…), puis **projets, prêts, planifiées** en arrière-plan pour afficher l’interface plus tôt.
- Calcul des **soldes par compte** en parallèle côté serveur lorsque plusieurs comptes sont listés.

---

## 13. Évolutions possibles

- Import de **relevé bancaire** et catégorisation assistée.
- **Notifications push** (nécessiterait un service dédié).
- **Multi-devises** (au-delà du FCFA).
- **Partage de budget** en couple / foyer avec rôles.

---

## 14. Maintenance de ce document

- **Mettre à jour** ce fichier lors de l’ajout d’un **écran majeur**, d’un **flux utilisateur** important, ou d’une **nouvelle entité métier** (nouveau type d’opération, nouveau module).
- Titres affichés dans l’en-tête : `src/lib/pageTitles.ts`.
- Ce document doit rester **compréhensible par un lecteur non technique** dans les sections 1 à 11 ; l’annexe §12 peut être plus dense.

---

*Projet **monbudget** — nom produit **Yenni**. Document pour la compréhension produit, support et onboarding ; dernière révision globale : structuration « tout inclus » pour publics techniques et non techniques.*
