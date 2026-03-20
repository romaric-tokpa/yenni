import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import {
  getExpensesByDateRange,
  getIncomesByDateRange,
  getFixedChargePaymentsByDateRange,
  getLoanPaymentsByDateRange,
  getLoans,
  getSalaries,
  getOtherIncomes,
} from "@/lib/db";
import { INCOME_SOURCE_SALARY_SETTINGS } from "@/lib/constants";

/** Retourne les revenus et dépenses par mois pour une année */
export async function GET(req: NextRequest) {
  try {
    const year = parseInt(
      new URL(req.url).searchParams.get("year") || String(new Date().getFullYear())
    );
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;

    const [expenses, incomes, fixedPayments, loanPayments, loans, salariesData, otherIncomes] =
      await Promise.all([
        getExpensesByDateRange(start, end),
        getIncomesByDateRange(start, end),
        getFixedChargePaymentsByDateRange(start, end),
        getLoanPaymentsByDateRange(start, end),
        getLoans(),
        getSalaries(year),
        getOtherIncomes(year),
      ]);
    const salaries = salariesData.amounts;

    const loansById: Record<number, { type: string }> = {};
    loans.forEach((l) => {
      loansById[l.id] = { type: l.type };
    });

    const monthly = Array.from({ length: 12 }, (_, m) => {
      const monthStr = String(m + 1).padStart(2, "0");
      const nextMonth = m === 11 ? "01" : String(m + 2).padStart(2, "0");
      const nextYear = m === 11 ? year + 1 : year;
      const monthStart = `${year}-${monthStr}-01`;
      const monthEnd = `${nextYear}-${nextMonth}-01`;

      const monthExpenses = expenses.filter(
        (e) => e.date >= monthStart && e.date < monthEnd
      );
      const monthIncomes = incomes.filter(
        (i) => i.date >= monthStart && i.date < monthEnd
      );
      const monthFixed = fixedPayments.filter((f) => f.month === m && f.year === year);
      const monthLoanPayments = loanPayments.filter(
        (lp) => lp.date >= monthStart && lp.date < monthEnd
      );

      let income =
        (salaries[m] || 0) +
        (otherIncomes[m] || 0) +
        monthIncomes.reduce(
          (s, i) => s + (i.source === INCOME_SOURCE_SALARY_SETTINGS ? 0 : i.amount),
          0,
        );
      let expensesTotal =
        monthFixed.reduce((s, f) => s + f.amount, 0) +
        monthExpenses.reduce((s, e) => s + e.amount + (e.transaction_fee ?? 0), 0);

      monthLoanPayments.forEach((lp) => {
        const loan = loansById[lp.loan_id];
        if (loan?.type === "personal_lent") {
          income += lp.amount;
        } else if (loan) {
          expensesTotal += lp.amount + (lp.fees || 0);
        }
      });

      return {
        month: m,
        Revenus: income,
        Dépenses: expensesTotal,
      };
    });

    return NextResponse.json(monthly);
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
