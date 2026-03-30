/** Taille max du fichier image décodé (logo compte opérateur) */
export const MAX_ACCOUNT_LOGO_BYTES = 400 * 1024;

export const ACCOUNT_LOGO_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

export function accountKindIsBank(kind: string): boolean {
  return kind.startsWith("bank_");
}

/** Logo fichier / URL : Mobile Money, comptes bancaires */
export function accountKindAllowsLogo(kind: string): boolean {
  return kind === "mobile_money" || accountKindIsBank(kind);
}
