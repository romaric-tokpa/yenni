import { format } from "date-fns";

export type TreasuryPeriodMode = "month" | "quarter" | "year" | "custom";

/** Date du jour (fuseau local), format AAAA-MM-JJ. */
export function todayIsoLocal(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** Dernier jour du mois (monthIndex 0 = janvier). */
export function lastDayOfMonthIso(year: number, monthIndex0: number): string {
  const d = new Date(year, monthIndex0 + 1, 0);
  return format(d, "yyyy-MM-dd");
}

export function endOfYearIso(year: number): string {
  return `${year}-12-31`;
}

/** quarterIndex : 0 = T1 (jan–mar), …, 3 = T4. */
export function endOfQuarterIso(year: number, quarterIndex: number): string {
  const lastMonthIdx = quarterIndex * 3 + 2;
  return lastDayOfMonthIso(year, lastMonthIdx);
}

/** Plus petite des deux dates ISO AAAA-MM-JJ. */
export function minIsoDate(a: string, b: string): string {
  return a <= b ? a : b;
}

export function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T12:00:00`);
  return !Number.isNaN(t);
}

/**
 * Fin théorique de période pour la trésorerie « actifs », puis plafonnée à aujourd’hui
 * (pas d’écritures futures).
 */
export function effectiveTreasuryThroughDate(periodEndIso: string, todayIso: string = todayIsoLocal()): string {
  return minIsoDate(periodEndIso, todayIso);
}
