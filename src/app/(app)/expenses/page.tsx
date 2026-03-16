"use client";
import { useBudgetContext } from "@/contexts/BudgetContext";
import ExpenseTracker from "@/components/ExpenseTracker";

export default function ExpensesPage() {
  const { showToast, ...budget } = useBudgetContext();
  return <ExpenseTracker budget={budget} showToast={showToast} />;
}
