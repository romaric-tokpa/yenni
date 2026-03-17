import { NextRequest, NextResponse } from "next/server";
import {
  getExpensesByDateRange,
  getIncomesByDateRange,
  getFixedChargePaymentsByDateRange,
  getLoanPaymentsByDateRange,
  getLoans,
  getSavings,
  getSalaries,
  getProjects,
  getPlannedExpenses,
} from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const start = sp.get("start");
    const end = sp.get("end");
    const year = sp.get("year");

    if (!start || !end) {
      return NextResponse.json({ error: "Paramètres start et end requis" }, { status: 400 });
    }

    const y = year ? parseInt(year) : new Date().getFullYear();

    const [expenses, incomes, fixedPayments, loanPayments, loans, savings, salaries, projects, allPlanned] = await Promise.all([
      getExpensesByDateRange(start, end),
      getIncomesByDateRange(start, end),
      getFixedChargePaymentsByDateRange(start, end),
      getLoanPaymentsByDateRange(start, end),
      getLoans(),
      getSavings(y),
      getSalaries(y),
      getProjects(),
      getPlannedExpenses(),
    ]);

    const plannedExpenses = allPlanned.filter((p) => p.status !== "cancelled");

    return NextResponse.json({
      expenses,
      incomes,
      fixedPayments,
      loanPayments,
      loans,
      savings,
      salaries,
      projects,
      plannedExpenses,
    });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json({ error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
