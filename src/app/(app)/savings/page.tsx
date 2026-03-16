"use client";
import { useBudgetContext } from "@/contexts/BudgetContext";
import SavingsTracker from "@/components/SavingsTracker";

export default function SavingsPage() {
  const budget = useBudgetContext();
  return <SavingsTracker budget={budget} />;
}
