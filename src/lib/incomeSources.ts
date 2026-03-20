/** Libellés des sources de revenu (clés API / formulaires). */
export const INCOME_SOURCE_LABELS: Record<string, string> = {
  salary: "Salaire",
  freelance: "Freelance",
  gift: "Don / Cadeau",
  refund: "Remboursement",
  investment: "Investissement",
  project: "Épargne projet",
  loan_recovery: "Remboursement prêt reçu",
  other: "Autre",
};

export function getIncomeSourceLabel(source: string): string {
  return INCOME_SOURCE_LABELS[source] ?? source;
}
