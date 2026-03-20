/**
 * Utilitaires pour la route /modal — ouverture et fermeture des popups
 */

export type ModalType =
  | "new-expense"
  | "plan-expense"
  | "new-wish-list"
  | "new-wish-item"
  | "purchase-wish"
  | "new-shopping-list"
  | "new-shopping-item"
  | "purchase-shopping"
  | "pay-loan"
  | "new-income"
  | "quick-transfer"
  | "new-project"
  | "add-charge"
  | "add-category"
  | "add-wish-category"
  | "pay-charge";

export interface ModalParams {
  type: ModalType;
  returnTo?: string;
  listId?: string;
  listName?: string;
  itemId?: string;
  itemName?: string;
  loanId?: string;
  chargeId?: string;
  projectId?: string;
  [key: string]: string | undefined;
}

export function buildModalUrl(params: ModalParams): string {
  const search = new URLSearchParams();
  search.set("type", params.type);
  if (params.returnTo) search.set("returnTo", params.returnTo);
  if (params.listId) search.set("listId", params.listId);
  if (params.listName) search.set("listName", params.listName ?? "");
  if (params.itemId) search.set("itemId", params.itemId);
  if (params.itemName) search.set("itemName", params.itemName ?? "");
  if (params.loanId) search.set("loanId", params.loanId);
  if (params.chargeId) search.set("chargeId", params.chargeId);
  if (params.projectId) search.set("projectId", params.projectId);
  return `/modal?${search.toString()}`;
}

/** Ouvre un modal via navigation (à utiliser avec router.push ou Link href) */
export function getModalHref(params: ModalParams): string {
  return buildModalUrl(params);
}

export function openModal(params: ModalParams): string {
  return buildModalUrl(params);
}
