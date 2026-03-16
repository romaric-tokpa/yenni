"use client";
import dynamic from "next/dynamic";
import { useBudgetContext } from "@/contexts/BudgetContext";

const LoansView = dynamic(() => import("@/components/LoansView"), {
  loading: () => <div className="animate-pulse h-64 rounded-2xl bg-white/5" />,
});

export default function LoansPage() {
  const { showToast, ...budget } = useBudgetContext();
  return <LoansView budget={budget} showToast={showToast} />;
}
