"use client";
import { useBudgetContext } from "@/contexts/BudgetContext";
import Dashboard from "@/components/Dashboard";

export default function DashboardPage() {
  const budget = useBudgetContext();
  return <Dashboard budget={budget} />;
}
