/**
 * Parse les lignes du tableau d'amortissement exporté SGCI / PDF (format texte avec « ! »).
 * Ex. : !015!25/03/2026! 65.392! 23.091! ! ! ! ! 94.179!NDC!
 */

export function parseFrenchCfaAmount(raw: string): number {
  const s = String(raw ?? "")
    .trim()
    .replace(/\s/g, "");
  if (!s) return 0;
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    return Math.round(Number(s.replace(/\./g, "")));
  }
  if (/^\d+,\d+$/.test(s)) {
    return Math.round(Number(s.replace(",", ".")));
  }
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export type ParsedSgciScheduleLine = {
  number: number;
  dueDateIso: string;
  principal: number;
  interest: number;
  totalPayment: number;
  bankStatus: string;
};

function findLastAmountAndStatus(segments: string[]): { total: number; status: string } {
  let status = "";
  let totalPayment = 0;
  for (let i = segments.length - 1; i >= 1; i--) {
    const t = segments[i]?.trim() ?? "";
    if (!t) continue;
    if (/^[A-Za-z]{2,6}$/.test(t)) {
      status = t;
      continue;
    }
    const amt = parseFrenchCfaAmount(t);
    if (amt > 0) {
      totalPayment = amt;
      break;
    }
  }
  return { total: totalPayment, status };
}

/**
 * Extrait la ligne principale d’une échéance (lignes PDF SGCI avec « ! »).
 * Gère aussi la 1ère ligne frais (montant total en fin de ligne, ex. 108.900!CPT!).
 */
export function parseSgciPdfScheduleMainLine(line: string): ParsedSgciScheduleLine | null {
  const trimmed = line.trim();
  if (!trimmed.includes("!")) return null;
  const segments = trimmed.split("!").map((s) => s.trim());
  if (segments.length < 6) return null;
  const num = parseInt(segments[1] ?? "", 10);
  if (!Number.isFinite(num) || num < 1) return null;
  const dateRaw = segments[2] ?? "";
  const dm = dateRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!dm) return null;
  const dueDateIso = `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
  const principal = parseFrenchCfaAmount(segments[3] ?? "0");
  const interest = parseFrenchCfaAmount(segments[4] ?? "0");
  const { total: totalPayment, status: bankStatus } = findLastAmountAndStatus(segments);
  let total = totalPayment;
  if (total <= 0 && principal + interest > 0) {
    total = principal + interest;
  }
  if (total <= 0 && principal === 0 && interest === 0) return null;
  return {
    number: num,
    dueDateIso,
    principal,
    interest,
    totalPayment: total,
    bankStatus: bankStatus || "—",
  };
}
