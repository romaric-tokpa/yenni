"use client";
import dynamic from "next/dynamic";
import { useBudgetContext } from "@/contexts/BudgetContext";

const SavingsTracker = dynamic(() => import("@/components/SavingsTracker"), {
  loading: () => <div className="animate-pulse h-64 rounded-2xl bg-white/5" />,
});

export default function SavingsPage() {
  const budget = useBudgetContext();
  return <SavingsTracker budget={budget} />;
}
