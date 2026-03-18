/**
 * Utilitaires pour les objectifs financiers intelligents.
 * Calcule l'épargne mensuelle suggérée et la faisabilité.
 */

/** Mois restants jusqu'à la date cible (inclusif du mois courant). */
export function monthsUntilDeadline(deadline: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(deadline);
  end.setHours(0, 0, 0, 0);
  if (end < today) return 0;
  const months = (end.getFullYear() - today.getFullYear()) * 12 + (end.getMonth() - today.getMonth()) + 1;
  return Math.max(1, months);
}

/** Nombre de mois dans la période [début, fin] (inclusif). Ex: mars → déc = 10 mois. */
export function monthsBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  if (end < start) return 0;
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
  return Math.max(1, months);
}

/** Vérifie si une date est dans la période [start, end]. */
export function isDateInPeriod(date: Date, startDate: string, endDate: string): boolean {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return d >= start && d <= end;
}

/** Mois restants dans la période. Si avant le début, retourne totalMonths. Si après la fin, retourne 0. */
export function monthsRemainingInPeriod(
  startDate: string,
  endDate: string
): { totalMonths: number; monthsLeft: number; hasStarted: boolean } {
  const today = new Date();
  const totalMonths = monthsBetween(startDate, endDate);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (today < start) {
    return { totalMonths, monthsLeft: totalMonths, hasStarted: false };
  }
  if (today > end) {
    return { totalMonths, monthsLeft: 0, hasStarted: true };
  }
  const monthsLeft = monthsUntilDeadline(endDate);
  return { totalMonths, monthsLeft, hasStarted: true };
}

export function monthlySavingsNeeded(targetAmount: number, savedAmount: number, monthsRemaining: number): number {
  const remaining = Math.max(0, targetAmount - savedAmount);
  if (monthsRemaining <= 0) return 0;
  return Math.ceil(remaining / monthsRemaining);
}

/** Mensualité fixe : target / totalMonths. Ne change pas selon l'épargne déjà réalisée. */
export function monthlySavingsFixed(targetAmount: number, totalMonths: number): number {
  if (totalMonths <= 0) return 0;
  return Math.ceil(targetAmount / totalMonths);
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
