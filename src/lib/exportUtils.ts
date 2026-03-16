import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { formatCFA } from "./constants";
import { MONTHS_FULL } from "./constants";
import type { Expense, FixedChargePayment, Category } from "./types";

export interface BilanData {
  month: number;
  year: number;
  totalIncome: number;
  totalFixed: number;
  totalMonthSpent: number;
  monthSaving: number;
  monthLoanRepayments: number;
  totalExpenses: number;
  soldeNet: number;
  dailyBudget: number;
  totalSaved: number;
  totalProjectSaved: number;
  catSpending: Record<string, number>;
  categories: Category[];
  fixedChargesLabel?: string;
}

export async function exportBilanPDFFromData(data: BilanData): Promise<void> {
  const div = document.createElement("div");
  div.innerHTML = createBilanHTML(data);
  div.style.position = "fixed";
  div.style.left = "-9999px";
  div.style.top = "0";
  div.style.width = "600px";
  document.body.appendChild(div);
  try {
    await exportBilanPDF(div, `bilan-${MONTHS_FULL[data.month].toLowerCase()}-${data.year}.pdf`);
  } finally {
    document.body.removeChild(div);
  }
}

export async function exportBilanPDF(
  element: HTMLElement,
  filename?: string
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#0a0e1a",
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const imgWidth = pageWidth - 2 * margin;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (imgHeight > pageHeight - 2 * margin) {
    pdf.addImage(imgData, "PNG", margin, margin, imgWidth, pageHeight - 2 * margin);
  } else {
    pdf.addImage(imgData, "PNG", margin, margin, imgWidth, imgHeight);
  }

  const name = filename || `bilan-yenni-${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(name);
}

export function createBilanHTML(data: BilanData): string {
  const monthLabel = MONTHS_FULL[data.month];
  const dateStr = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const rows = [
    ["Actifs (Revenus)", formatCFA(data.totalIncome), "+"],
    ["Charges fixes", formatCFA(data.totalFixed), "-"],
    ["Dépenses variables", formatCFA(data.totalMonthSpent), "-"],
    ["Épargne mensuelle", formatCFA(data.monthSaving), "-"],
    ...(data.monthLoanRepayments > 0
      ? [["Remboursements prêts", formatCFA(data.monthLoanRepayments), "-"]]
      : []),
    ["Total sorties", formatCFA(data.totalExpenses), "-"],
    ["Solde net", formatCFA(Math.abs(data.soldeNet)), data.soldeNet >= 0 ? "+" : "-"],
  ];

  let tableRows = "";
  rows.forEach(([label, value, sign]) => {
    tableRows += `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #334155;color:#94a3b8;">${label}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #334155;text-align:right;font-family:monospace;font-weight:600;color:#e2e8f0;">${sign} ${value} FCFA</td>
      </tr>`;
  });

  let catRows = "";
  data.categories.forEach((cat) => {
    const spent = data.catSpending[cat.id] || 0;
    if (cat.budget > 0) {
      catRows += `
        <tr>
          <td style="padding:5px 10px;border-bottom:1px solid #334155;color:#94a3b8;">${cat.label}</td>
          <td style="padding:5px 10px;border-bottom:1px solid #334155;text-align:right;color:#e2e8f0;">${formatCFA(cat.budget)}</td>
          <td style="padding:5px 10px;border-bottom:1px solid #334155;text-align:right;color:#f59e0b;">${formatCFA(spent)}</td>
        </tr>`;
    }
  });

  return `
<div style="font-family:'Segoe UI',sans-serif;background:#0a0e1a;color:#e2e8f0;padding:24px;max-width:600px;">
  <div style="text-align:center;margin-bottom:24px;">
    <h1 style="font-size:22px;font-weight:700;color:#10b981;margin:0;">Yenni</h1>
    <p style="font-size:14px;color:#64748b;margin:4px 0 0 0;">Bilan mensuel</p>
  </div>
  <div style="margin-bottom:20px;">
    <h2 style="font-size:16px;font-weight:600;color:#f1f5f9;margin:0 0 8px 0;">${monthLabel} ${data.year}</h2>
    <p style="font-size:11px;color:#64748b;margin:0;">Généré le ${dateStr}</p>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    ${tableRows}
  </table>
  <div style="margin-bottom:12px;">
    <h3 style="font-size:12px;font-weight:600;color:#94a3b8;margin:0 0 8px 0;">Budget par catégorie</h3>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <tr>
      <th style="padding:6px 10px;text-align:left;border-bottom:2px solid #334155;color:#64748b;font-size:11px;">Catégorie</th>
      <th style="padding:6px 10px;text-align:right;border-bottom:2px solid #334155;color:#64748b;font-size:11px;">Budget</th>
      <th style="padding:6px 10px;text-align:right;border-bottom:2px solid #334155;color:#64748b;font-size:11px;">Dépensé</th>
    </tr>
    ${catRows || "<tr><td colspan='3' style='padding:12px;color:#64748b;'>Aucune catégorie</td></tr>"}
  </table>
  <div style="border-top:1px solid #334155;padding-top:16px;font-size:11px;color:#64748b;">
    <p style="margin:0;">Épargne cumulée : <strong style="color:#f59e0b;">${formatCFA(data.totalSaved)} FCFA</strong></p>
    ${data.totalProjectSaved > 0 ? `<p style="margin:4px 0 0 0;">Projets : <strong style="color:#10b981;">${formatCFA(data.totalProjectSaved)} FCFA</strong></p>` : ""}
  </div>
</div>`;
}

export function exportExpensesCSV(
  expenses: Expense[],
  fixedPayments: FixedChargePayment[],
  month: number,
  year: number,
  categories: { id: string; label: string }[]
): void {
  const monthLabel = MONTHS_FULL[month];
  const headers = ["Date", "Heure", "Type", "Description", "Catégorie", "Montant (FCFA)", "Notes"];
  const rows: string[][] = [headers];

  const getCategoryLabel = (id: string) => categories.find((c) => c.id === id)?.label || id;

  expenses.forEach((e) => {
    rows.push([
      e.date,
      e.time || "00:00",
      "Dépense variable",
      e.description,
      getCategoryLabel(e.category),
      String(e.amount),
      e.notes || "",
    ]);
  });

  fixedPayments.forEach((p) => {
    rows.push([
      p.date,
      p.time || "00:00",
      "Charge fixe",
      p.label,
      "-",
      String(p.amount),
      p.notes || "",
    ]);
  });

  const escape = (s: string) => {
    const str = String(s);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `depenses-${monthLabel.toLowerCase()}-${year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface HistoryTx {
  id: string;
  date: string;
  time: string;
  description: string;
  amount: number;
  type: string;
  detail?: string;
  sign: "in" | "out" | "neutral";
}

const TX_TYPE_LABELS: Record<string, string> = {
  expense: "Dépense",
  income: "Revenu",
  fixed: "Charge fixe",
  loan: "Prêt",
  saving: "Épargne",
  project: "Projet",
  planned: "Planifiée",
};

export function exportHistoryCSV(
  transactions: HistoryTx[],
  rangeLabel: string,
  totalIn: number,
  totalOut: number,
  balance: number
): void {
  const headers = ["Date", "Heure", "Type", "Description", "Détail", "Montant (FCFA)", "Sens"];
  const rows: string[][] = [headers];

  transactions.forEach((t) => {
    const sign = t.sign === "in" ? "+" : t.sign === "out" ? "-" : "";
    rows.push([
      t.date,
      t.time || "00:00",
      TX_TYPE_LABELS[t.type] || t.type,
      t.description,
      t.detail || "",
      String(t.amount),
      sign,
    ]);
  });

  rows.push([], ["RÉSUMÉ", "", "", "", "", "", ""]);
  rows.push(["Total entrées", "", "", "", "", formatCFA(totalIn), "+"]);
  rows.push(["Total sorties", "", "", "", "", formatCFA(totalOut), "-"]);
  rows.push(["Solde", "", "", "", "", formatCFA(Math.abs(balance)), balance >= 0 ? "+" : "-"]);

  const escape = (s: string) => {
    const str = String(s);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const bom = "\uFEFF";
  const safeLabel = rangeLabel.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-").toLowerCase();
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `historique-${safeLabel}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function createHistoryHTML(
  transactions: HistoryTx[],
  rangeLabel: string,
  totalIn: number,
  totalOut: number,
  balance: number
): string {
  const dateStr = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  let tableRows = "";
  transactions.forEach((t) => {
    const sign = t.sign === "in" ? "+" : t.sign === "out" ? "-" : "";
    const typeLabel = TX_TYPE_LABELS[t.type] || t.type;
    tableRows += `
      <tr>
        <td style="padding:5px 8px;border-bottom:1px solid #334155;color:#94a3b8;font-size:11px;">${t.date}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #334155;color:#94a3b8;font-size:11px;">${t.time || "00:00"}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #334155;color:#94a3b8;font-size:11px;">${typeLabel}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #334155;color:#e2e8f0;font-size:11px;">${t.description}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #334155;text-align:right;font-family:monospace;font-weight:600;font-size:11px;color:${t.sign === "in" ? "#10b981" : t.sign === "out" ? "#f59e0b" : "#64748b"};">${sign} ${formatCFA(t.amount)}</td>
      </tr>`;
  });

  return `
<div style="font-family:'Segoe UI',sans-serif;background:#0a0e1a;color:#e2e8f0;padding:24px;max-width:700px;">
  <div style="text-align:center;margin-bottom:20px;">
    <h1 style="font-size:22px;font-weight:700;color:#10b981;margin:0;">Yenni</h1>
    <p style="font-size:14px;color:#64748b;margin:4px 0 0 0;">Historique des transactions</p>
  </div>
  <div style="margin-bottom:16px;">
    <h2 style="font-size:16px;font-weight:600;color:#f1f5f9;margin:0 0 4px 0;">${rangeLabel}</h2>
    <p style="font-size:11px;color:#64748b;margin:0;">Généré le ${dateStr} · ${transactions.length} transaction(s)</p>
  </div>
  <div style="display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap;">
    <div style="flex:1;min-width:100px;padding:12px;background:rgba(16,185,129,0.1);border-radius:8px;">
      <div style="font-size:10px;color:#64748b;">Entrées</div>
      <div style="font-size:14px;font-weight:700;color:#10b981;">+${formatCFA(totalIn)} FCFA</div>
    </div>
    <div style="flex:1;min-width:100px;padding:12px;background:rgba(239,68,68,0.1);border-radius:8px;">
      <div style="font-size:10px;color:#64748b;">Sorties</div>
      <div style="font-size:14px;font-weight:700;color:#ef4444;">-${formatCFA(totalOut)} FCFA</div>
    </div>
    <div style="flex:1;min-width:100px;padding:12px;background:rgba(245,158,11,0.1);border-radius:8px;">
      <div style="font-size:10px;color:#64748b;">Solde</div>
      <div style="font-size:14px;font-weight:700;color:${balance >= 0 ? "#10b981" : "#ef4444"};">${balance >= 0 ? "+" : "-"}${formatCFA(Math.abs(balance))} FCFA</div>
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:11px;">
    <tr>
      <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #334155;color:#64748b;">Date</th>
      <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #334155;color:#64748b;">Heure</th>
      <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #334155;color:#64748b;">Type</th>
      <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #334155;color:#64748b;">Description</th>
      <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #334155;color:#64748b;">Montant</th>
    </tr>
    ${tableRows || "<tr><td colspan='5' style='padding:16px;color:#64748b;'>Aucune transaction</td></tr>"}
  </table>
</div>`;
}

export async function exportHistoryPDF(
  transactions: HistoryTx[],
  rangeLabel: string,
  totalIn: number,
  totalOut: number,
  balance: number
): Promise<void> {
  const div = document.createElement("div");
  div.innerHTML = createHistoryHTML(transactions, rangeLabel, totalIn, totalOut, balance);
  div.style.position = "fixed";
  div.style.left = "-9999px";
  div.style.top = "0";
  div.style.width = "700px";
  document.body.appendChild(div);
  try {
    const safeLabel = rangeLabel.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-").toLowerCase();
    await exportBilanPDF(div, `historique-${safeLabel}.pdf`);
  } finally {
    document.body.removeChild(div);
  }
}
