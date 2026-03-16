"use client";
import dynamic from "next/dynamic";
import { useBudgetContext } from "@/contexts/BudgetContext";
import { useAuth } from "@/contexts/AuthContext";

const Dashboard = dynamic(() => import("@/components/Dashboard"), {
  loading: () => <div className="animate-pulse h-64 rounded-2xl bg-white/5" />,
});

export default function DashboardPage() {
  const budget = useBudgetContext();
  const { user } = useAuth();
  return <Dashboard budget={budget} user={user} />;
}
