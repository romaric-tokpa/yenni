import { INCOME_SOURCE_SALARY_SETTINGS } from "@/lib/constants";

/**
 * Libellés pour `incomes.source` (saisie manuelle, sync salaire, anciennes données).
 */
export const INCOME_SOURCE_LABELS: Record<string, string> = {
  [INCOME_SOURCE_SALARY_SETTINGS]: "Salaire (réglages)",
  salary: "Salaire",
  /** Ligne synthétique historique quand le sync `incomes` n’existe pas encore */
  salaire: "Salaire net (réglages)",
  freelance: "Freelance",
  commission: "Commissions",
  donation: "Don",
  gift: "Don / cadeau",
  refund: "Remboursement",
  investment: "Placements / intérêts",
  rental: "Loyers / locations",
  sale: "Vente",
  project: "Épargne projet",
  loan_recovery: "Remboursement prêt reçu",
  other: "Autre",
};

/**
 * Types proposés à la saisie d’un nouveau revenu (hors salaire mensuel des Réglages).
 * La valeur est stockée dans `incomes.source`.
 */
export const INCOME_TYPE_OPTIONS: { id: string; label: string }[] = [
  { id: "freelance", label: "Freelance" },
  { id: "commission", label: "Commissions" },
  { id: "donation", label: "Don" },
  { id: "gift", label: "Don / cadeau" },
  { id: "refund", label: "Remboursement" },
  { id: "rental", label: "Loyers / locations" },
  { id: "investment", label: "Placements / intérêts" },
  { id: "sale", label: "Vente" },
  { id: "project", label: "Épargne projet" },
  { id: "loan_recovery", label: "Remboursement prêt reçu" },
  { id: "other", label: "Autre" },
];

export function getIncomeSourceLabel(source: string): string {
  return INCOME_SOURCE_LABELS[source] ?? source;
}

/** Revenus comptés dans le budget mensuel entrées (hors doublon salaire réglages et versements projet). */
export function isIncomeCountedInMonthlyBudget(source: string | null | undefined): boolean {
  const s = source ?? "other";
  return s !== INCOME_SOURCE_SALARY_SETTINGS && s !== "project";
}

/** Réservé au sync automatique Réglages → revenu lié. */
export function isForbiddenManualIncomeSource(source: string): boolean {
  return source === INCOME_SOURCE_SALARY_SETTINGS;
}
