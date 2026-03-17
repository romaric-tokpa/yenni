"use client";
import dynamic from "next/dynamic";
import { useBudgetContext } from "@/contexts/BudgetContext";

const LoanFormView = dynamic(() => import("@/components/LoanFormView"), {
  loading: () => <div className="animate-pulse h-64 rounded-2xl bg-white/5" />,
});

export default function NewLoanPage() {
  const { showToast, addLoan } = useBudgetContext();
  return <LoanFormView budget={{ addLoan }} showToast={showToast} />;
}
