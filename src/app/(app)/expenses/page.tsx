"use client";
import dynamic from "next/dynamic";
import { useBudgetContext } from "@/contexts/BudgetContext";

const ExpenseTracker = dynamic(() => import("@/components/ExpenseTracker"), {
  loading: () => <div className="animate-pulse h-64 rounded-2xl bg-white/5" />,
});

export default function ExpensesPage() {
  const { showToast, ...budget } = useBudgetContext();
  return <ExpenseTracker budget={budget} showToast={showToast} />;
}
