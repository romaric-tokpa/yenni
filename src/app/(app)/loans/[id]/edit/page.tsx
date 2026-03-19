"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useBudgetContext } from "@/contexts/BudgetContext";
import type { Loan } from "@/lib/types";

const LoanFormView = dynamic(() => import("@/components/LoanFormView"), {
  loading: () => <div className="animate-pulse h-64 rounded-2xl bg-white/5" />,
});

export default function EditLoanPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast, updateLoan, regenerateLoanSchedule, loans } = useBudgetContext();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);

  const id = typeof params.id === "string" ? parseInt(params.id, 10) : NaN;

  useEffect(() => {
    if (isNaN(id)) {
      setLoading(false);
      return;
    }
    const existing = loans.find((l) => l.id === id);
    if (existing) {
      setLoan(existing);
      setLoading(false);
    } else {
      fetch(`/api/loans?id=${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: Loan | { error?: string } | null) => {
          if (data && !Array.isArray(data) && "id" in data && !("error" in data)) {
            setLoan(data as Loan);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [id, loans]);

  if (loading) {
    return (
      <div className="animate-pulse h-64 rounded-2xl bg-white/5 flex items-center justify-center">
        <span className="text-slate-500">Chargement...</span>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <p className="text-slate-500">Prêt introuvable</p>
        <button
          onClick={() => router.push("/loans")}
          className="mt-4 text-emerald-400 hover:underline"
        >
          Retour aux prêts
        </button>
      </div>
    );
  }

  return (
    <LoanFormView
      budget={{ addLoan: async () => false, updateLoan, regenerateLoanSchedule }}
      showToast={showToast}
      loan={loan}
    />
  );
}
