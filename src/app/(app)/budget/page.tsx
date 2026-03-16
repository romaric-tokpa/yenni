"use client";
import { useBudgetContext } from "@/contexts/BudgetContext";
import BudgetView from "@/components/BudgetView";

export default function BudgetPage() {
  const budget = useBudgetContext();
  return <BudgetView budget={budget} />;
}
