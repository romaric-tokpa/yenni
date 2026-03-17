import { BudgetConfig } from "./types";

export const DEFAULT_CONFIG: BudgetConfig = {
  salary: 0,
  otherIncome: 0,
  fixedCharges: [],
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
  "landmark", "shield", "house", "piggy-bank", "globe", "flame", "bus", "bot",
  "monitor", "paperclip", "utensils", "car", "shirt", "party-popper", "users",
  "heart-pulse", "smartphone", "book-open", "wrench", "target", "home", "truck",
  "laptop", "plane", "graduation-cap", "gem", "hospital", "package", "gift",
];

export const CATEGORY_COLORS = [
  "#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444",
  "#EC4899", "#06B6D4", "#6366F1", "#78716C", "#F97316",
  "#14B8A6", "#A855F7",
];

/** Seuil à partir duquel on utilise la virtualisation des listes (évite le lag avec 1000+ items) */
export const VIRTUAL_LIST_THRESHOLD = 50;
