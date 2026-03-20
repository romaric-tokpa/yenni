import { addMonths, format } from "date-fns";
import type { AccountWithBalance, BudgetConfig } from "./types";

/** Revenu généré automatiquement depuis Réglages → Salaire + compte (exclu des totaux « revenus saisis » pour éviter doublon avec `monthSalary`). */
export const INCOME_SOURCE_SALARY_SETTINGS = "salary_settings";

const SALARY_SETTINGS_INCOME_NOTE_PREFIX = "__YENNI_SALARY__:";

/** Clé stockée dans `incomes.notes` pour upsert du revenu lié au salaire mensuel. */
export function salarySettingsIncomeNote(year: number, month: number): string {
  return `${SALARY_SETTINGS_INCOME_NOTE_PREFIX}${year}:${month}`;
}

/** Solde disponible : uniquement espèces + mobile money (comptes non archivés). */
export function sumLiquideCashAndMobileMoney(accounts: AccountWithBalance[]): number {
  return accounts
    .filter((a) => !a.is_archived && (a.kind === "cash" || a.kind === "mobile_money"))
    .reduce((s, a) => s + a.balance, 0);
}

/** Somme des soldes de tous les comptes non archivés (trésorerie totale). */
export function sumActiveAccountBalances(accounts: AccountWithBalance[]): number {
  return accounts.filter((a) => !a.is_archived).reduce((s, a) => s + a.balance, 0);
}

export const DEFAULT_CONFIG: BudgetConfig = {
  salary: 0,
  fixedCharges: [],
  wishCategories: [],
  categories: [
    { id: "food", label: "Alimentation", icon: "utensils", budget: 0, color: "#10B981" },
    { id: "transport", label: "Transport", icon: "car", budget: 0, color: "#3B82F6" },
    { id: "clothing", label: "Habillement", icon: "shirt", budget: 0, color: "#8B5CF6" },
    { id: "leisure", label: "Loisirs / Sorties", icon: "party-popper", budget: 0, color: "#F59E0B" },
    { id: "family", label: "Famille / Social", icon: "users", budget: 0, color: "#EF4444" },
    { id: "health", label: "Santé", icon: "heart-pulse", budget: 0, color: "#EC4899" },
    { id: "comm", label: "Communication", icon: "smartphone", budget: 0, color: "#06B6D4" },
    { id: "education", label: "Formation / Livres", icon: "book-open", budget: 0, color: "#6366F1" },
    { id: "loan_repayment", label: "Remboursement de prêt", icon: "landmark", budget: 0, color: "#0EA5E9" },
    { id: "misc", label: "Divers / Imprévus", icon: "wrench", budget: 0, color: "#78716C" },
  ],
  savingsGoal: 0,
};

/** Années disponibles dans les sélecteurs (année courante - 3 jusqu'à 2055) */
export function getSelectableYears(): number[] {
  const current = new Date().getFullYear();
  const min = current - 3;
  const max = 2055;
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

export const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
export const MONTHS_FULL = MONTHS_FR;
export const MONTHS_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export function formatCFA(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n || 0));
}

/** URL d'avatar : data URI (base64) ou chemin legacy → /api/avatars/x */
export function getAvatarSrc(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("data:")) return path;
  const match = path.match(/(?:^\/?)?uploads\/avatars\/(.+)$/);
  if (match) return `/api/avatars/${match[1]}`;
  if (/^[^/]+\.(jpg|jpeg|png|webp|gif)$/i.test(path.trim())) return `/api/avatars/${path.trim()}`;
  return path;
}

export const AVAILABLE_ICONS = [
  "landmark", "shield", "house", "banknote", "piggy-bank", "globe", "flame", "bus", "bot",
  "monitor", "paperclip", "utensils", "car", "shirt", "party-popper", "users",
  "heart-pulse", "smartphone", "credit-card", "book-open", "wrench", "target", "home", "truck",
  "laptop", "plane", "graduation-cap", "gem", "hospital", "package", "gift",
];

export const CATEGORY_COLORS = [
  "#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444",
  "#EC4899", "#06B6D4", "#6366F1", "#78716C", "#F97316",
  "#14B8A6", "#A855F7",
];

/** Seuil à partir duquel on utilise la virtualisation des listes (évite le lag avec 1000+ items) */
export const VIRTUAL_LIST_THRESHOLD = 50;

/** Nombre d'éléments par page dans la liste des dépenses */
/** Taille de page pour la liste Transactions (liste paginée). */
export const EXPENSES_PAGE_SIZE = 25;

/** Modes de paiement récurrents pour les dépenses */
/** Types de compte suggérés à la création (libellé + id technique) */
export const ACCOUNT_KIND_PRESETS = [
  { id: "cash", label: "Espèces" },
  { id: "vault", label: "Coffre — épargne bloquée" },
  { id: "mobile_money", label: "Mobile Money" },
  { id: "prepaid_card", label: "Carte prépayée" },
  { id: "bank_current", label: "Compte bancaire — Courant" },
  { id: "bank_savings", label: "Compte bancaire — Épargne classique" },
  { id: "bank_blocked_savings", label: "Plan d'épargne" },
  { id: "bank_loan", label: "Compte bancaire — Prêt" },
  { id: "other", label: "Autre" },
] as const;

/** Durées prédéfinies (mois) pour la création d’un compte coffre */
export const VAULT_PERIOD_MONTHS_PRESETS = [3, 6, 12, 18, 24] as const;

export type AccountKindId = (typeof ACCOUNT_KIND_PRESETS)[number]["id"];

/**
 * Compte bancaire utilisable pour les prélèvements (échéances prêt, etc.) : trésorerie « banque »,
 * hors plan d'épargne (`bank_blocked_savings`). Exclut coffre, espèces, mobile money.
 */
export function isBankTreasuryDebitAccount(kind: string): boolean {
  if (!kind.startsWith("bank_")) return false;
  if (kind === "bank_blocked_savings") return false;
  return true;
}

/** True si les sorties (dépenses, transferts depuis ce compte) sont interdites (coffre verrouillé). */
export function isVaultAccountLocked(vaultUnlocksOn: string | null | undefined): boolean {
  if (vaultUnlocksOn == null || String(vaultUnlocksOn).trim() === "") return false;
  const today = new Date().toISOString().slice(0, 10);
  return today < String(vaultUnlocksOn).trim();
}

/**
 * Coffre (`vault`) ou plan d'épargne (`bank_blocked_savings`) avec une échéance de blocage active :
 * l'argent peut encore entrer ; les sorties sont bloquées jusqu'à la date ou un déblocage manuel.
 */
export function accountHasActiveOutgoingLock(kind: string, vaultUnlocksOn: string | null | undefined): boolean {
  if (!isVaultAccountLocked(vaultUnlocksOn)) return false;
  return kind === "vault" || kind === "bank_blocked_savings";
}

/** Date YYYY-MM-DD à partir de laquelle un coffre créé aujourd’hui autorise les sorties (N mois plus tard). */
export function computeVaultUnlockDateFromNow(months: number): string {
  const m = Math.max(1, Math.min(120, Math.floor(Number(months)) || 1));
  return format(addMonths(new Date(), m), "yyyy-MM-dd");
}

/**
 * Solde du compte coffre lié au fonds d’urgence, si configuré et valide.
 * Sinon `null` (revenir à l’épargne saisie manuelle / période).
 */
export function getLinkedVaultEmergencyBalance(
  config: BudgetConfig,
  accounts: AccountWithBalance[],
): number | null {
  const id = config.emergency_fund_account_id;
  if (id == null || id === undefined || Number.isNaN(Number(id))) return null;
  const acc = accounts.find((a) => a.id === Number(id) && !a.is_archived);
  if (!acc || acc.kind !== "vault") return null;
  return Math.max(0, acc.balance);
}

/** Opérateurs / types de Mobile Money (comptes `kind === "mobile_money"`) */
export const MOBILE_MONEY_PROVIDERS = [
  { id: "wave", label: "Wave", color: "#21CBA6" },
  { id: "orange_money", label: "Orange Money", color: "#FF7900" },
  { id: "mtn_money", label: "MTN Mobile Money", color: "#FFCC00" },
  { id: "moov_money", label: "Moov Money", color: "#0066B3" },
  { id: "wizall", label: "Wizall", color: "#E31837" },
  { id: "other", label: "Autre", color: "#6366f1" },
] as const;

export type MobileMoneyProviderId = (typeof MOBILE_MONEY_PROVIDERS)[number]["id"];

export function mobileMoneyProviderLabel(id: string | undefined | null): string {
  if (!id) return "";
  const p = MOBILE_MONEY_PROVIDERS.find((x) => x.id === id);
  return p?.label ?? id;
}

/** Émetteurs de carte prépayée (`kind === "prepaid_card"`) */
export const PREPAID_CARD_PROVIDERS = [
  { id: "wave", label: "Wave", color: "#21CBA6" },
  { id: "orange_money", label: "Orange Money", color: "#FF7900" },
  { id: "mtn_money", label: "MTN", color: "#FFCC00" },
  { id: "djamo", label: "Djamo", color: "#7C3AED" },
  { id: "push", label: "Push", color: "#0EA5E9" },
  { id: "other", label: "Autre", color: "#6366f1" },
] as const;

export type PrepaidCardProviderId = (typeof PREPAID_CARD_PROVIDERS)[number]["id"];

export function prepaidCardProviderLabel(id: string | undefined | null): string {
  if (!id) return "";
  const p = PREPAID_CARD_PROVIDERS.find((x) => x.id === id);
  return p?.label ?? id;
}

/** Libellé complet type de compte (opérateur MM, carte prépayée, banque…) */
export function accountTypeLabel(kind: string, subtype?: string | null, institutionName?: string | null): string {
  const base = ACCOUNT_KIND_PRESETS.find((p) => p.id === kind)?.label ?? kind;
  if (kind === "mobile_money" && subtype) {
    const sub = mobileMoneyProviderLabel(subtype);
    return sub ? `${base} — ${sub}` : base;
  }
  if (kind === "prepaid_card" && subtype) {
    const sub = prepaidCardProviderLabel(subtype);
    return sub ? `${base} — ${sub}` : base;
  }
  const inst = institutionName?.trim();
  if (inst && kind.startsWith("bank_")) {
    return `${base} · ${inst}`;
  }
  return base;
}

/**
 * Pourcentage de frais de transaction suggéré selon le type de compte débité
 * (Mobile Money ~1 %, carte prépayée / banque ~1,5 %, espèces / coffre 0).
 */
export function suggestedTransactionFeePercentFromAccount(
  kind: string | undefined,
  _subtype?: string | null,
): number {
  if (!kind || kind === "cash" || kind === "vault") return 0;
  if (kind === "mobile_money") return 1;
  if (kind === "prepaid_card") return 1.5;
  if (kind.startsWith("bank_")) return 1.5;
  return 0;
}
