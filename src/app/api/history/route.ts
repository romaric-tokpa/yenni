import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import {
  getExpensesByDateRange,
  getIncomesByDateRange,
  getFixedChargePaymentsByDateRange,
  getLoanPaymentsByDateRange,
  getLoans,
  getSavings,
  getSalaries,
  getOtherIncomes,
  getProjects,
  getPlannedExpenses,
  getPurchasedWishListItemsByDateRange,
  getPurchasedShoppingListItemsByDateRange,
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

    const [
      expenses,
      incomes,
      fixedPayments,
      loanPayments,
      loans,
      savings,
      salaries,
      otherIncomes,
      projects,
      allPlanned,
      purchasedWishItems,
      purchasedShoppingItems,
    ] = await Promise.all([
      getExpensesByDateRange(start, end),
      getIncomesByDateRange(start, end),
      getFixedChargePaymentsByDateRange(start, end),
      getLoanPaymentsByDateRange(start, end),
      getLoans(),
      getSavings(y),
      getSalaries(y),
      getOtherIncomes(y),
      getProjects(),
      getPlannedExpenses(),
      getPurchasedWishListItemsByDateRange(start, end),
      getPurchasedShoppingListItemsByDateRange(start, end),
    ]);

    const plannedExpenses = allPlanned.filter((p) => p.status !== "cancelled");

    const expenseIdsFromWishShopping = new Set<number>();
    purchasedWishItems.forEach((w) => w.expense_id && expenseIdsFromWishShopping.add(w.expense_id));
    purchasedShoppingItems.forEach((s) => s.expense_id && expenseIdsFromWishShopping.add(s.expense_id));
    const expensesFiltered = expenses.filter((e) => !expenseIdsFromWishShopping.has(e.id));

    return NextResponse.json({
      expenses: expensesFiltered,
      incomes,
      fixedPayments,
      loanPayments,
      loans,
      savings,
      salaries,
      otherIncomes,
      projects,
      plannedExpenses,
      purchasedWishItems,
      purchasedShoppingItems,
    });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
