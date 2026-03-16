/**
 * Utilitaires pour les objectifs financiers intelligents.
 * Calcule l'épargne mensuelle suggérée et la faisabilité.
 */

export function monthsUntilDeadline(deadline: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(deadline);
  end.setHours(0, 0, 0, 0);
  if (end <= today) return 0;
  const months = (end.getFullYear() - today.getFullYear()) * 12 + (end.getMonth() - today.getMonth());
  return Math.max(1, months);
}

export function monthlySavingsNeeded(targetAmount: number, savedAmount: number, monthsRemaining: number): number {
  const remaining = Math.max(0, targetAmount - savedAmount);
  if (monthsRemaining <= 0) return 0;
  return Math.ceil(remaining / monthsRemaining);
}

export type FeasibilityLevel = "faisable" | "modere" | "difficile";

export function getFeasibility(monthlyNeeded: number, resteAVivre: number): FeasibilityLevel {
  if (resteAVivre <= 0) return "difficile";
  const ratio = monthlyNeeded / resteAVivre;
  if (ratio <= 0.3) return "faisable";
  if (ratio <= 0.5) return "modere";
  return "difficile";
}

export function getFeasibilityLabel(level: FeasibilityLevel): string {
  switch (level) {
    case "faisable": return "Faisable";
    case "modere": return "Modéré";
    case "difficile": return "Difficile";
  }
}

export function getFeasibilityColor(level: FeasibilityLevel): string {
  switch (level) {
    case "faisable": return "text-emerald-400";
    case "modere": return "text-amber-400";
    case "difficile": return "text-red-400";
  }
}

export function getFeasibilityBg(level: FeasibilityLevel): string {
  switch (level) {
    case "faisable": return "bg-emerald-500/20";
    case "modere": return "bg-amber-500/20";
    case "difficile": return "bg-red-500/20";
  }
}
