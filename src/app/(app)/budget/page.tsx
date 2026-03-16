"use client";
import dynamic from "next/dynamic";
import { useBudgetContext } from "@/contexts/BudgetContext";

const BudgetView = dynamic(() => import("@/components/BudgetView"), {
  loading: () => <div className="animate-pulse h-64 rounded-2xl bg-white/5" />,
});

export default function BudgetPage() {
  const budget = useBudgetContext();
  return <BudgetView budget={budget} />;
}
