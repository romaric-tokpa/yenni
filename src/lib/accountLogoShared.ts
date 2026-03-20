/** Taille max du fichier image décodé (logo compte opérateur) */
export const MAX_ACCOUNT_LOGO_BYTES = 400 * 1024;

export const ACCOUNT_LOGO_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

const BANK_ACCOUNT_KINDS = new Set([
  "bank_current",
  "bank_savings",
  "bank_blocked_savings",
  "bank_loan",
]);

export function accountKindIsBank(kind: string): boolean {
  return BANK_ACCOUNT_KINDS.has(kind);
}

/** Logo fichier / URL : Mobile Money, carte prépayée, comptes bancaires */
export function accountKindAllowsLogo(kind: string): boolean {
  return kind === "mobile_money" || kind === "prepaid_card" || accountKindIsBank(kind);
}
