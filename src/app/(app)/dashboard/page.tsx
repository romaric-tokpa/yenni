"use client";
import { useBudgetContext } from "@/contexts/BudgetContext";
import { useAuth } from "@/contexts/AuthContext";
import Dashboard from "@/components/Dashboard";

export default function DashboardPage() {
  const budget = useBudgetContext();
  const { user } = useAuth();
  return <Dashboard budget={budget} user={user} />;
}
