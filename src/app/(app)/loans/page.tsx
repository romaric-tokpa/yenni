"use client";
import { useBudgetContext } from "@/contexts/BudgetContext";
import LoansView from "@/components/LoansView";

export default function LoansPage() {
  const { showToast, ...budget } = useBudgetContext();
  return <LoansView budget={budget} showToast={showToast} />;
}
