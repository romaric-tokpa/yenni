"use client";
import { useState } from "react";
import { formatCFA } from "@/lib/constants";
import { Check, AlertTriangle } from "lucide-react";

interface LoanNextPaymentProps {
  dueDate: string;
  amount: number;
  principal: number;
  interest: number;
  insurance: number;
  daysUntil: number;
  isOverdue: boolean;
  onMarkPaid: (amount?: number) => Promise<void>;
  loading?: boolean;
}

export default function LoanNextPayment({
  dueDate,
  amount,
  principal,
  interest,
  insurance,
  daysUntil,
  isOverdue,
  onMarkPaid,
  loading = false,
}: LoanNextPaymentProps) {
  const [customAmount, setCustomAmount] = useState<string>("");
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const displayAmount = customAmount !== "" ? parseInt(customAmount, 10) : amount;
  const isValidAmount = customAmount === "" || (!isNaN(displayAmount) && displayAmount > 0);

  return (
    <div
      className={`rounded-2xl p-3 lg:p-5 border ${
        isOverdue ? "bg-red-500/10 border-red-500/30" : "glass border-white/10"
      }`}
    >
      <h3 className="text-sm font-semibold text-slate-200 mb-3">Prochaine échéance</h3>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="font-mono text-lg lg:text-xl font-bold text-emerald-400 mt-0.5">
          {formatCFA(displayAmount)} FCFA
        </span>
        <span className="text-slate-500 text-xs">— {formatDate(dueDate)}</span>
      </div>
      <div className="mb-3">
        <label className="block text-[10px] text-slate-500 mb-1">Montant facturé par la banque</label>
        <input
          type="number"
          placeholder={formatCFA(amount)}
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          className="input-field !text-sm !py-2 font-mono w-full"
        />
      </div>
      {isOverdue ? (
        <div className="flex items-center gap-2 text-red-400 text-xs font-medium mb-3">
          <AlertTriangle size={14} />
          EN RETARD DE {Math.abs(daysUntil)} JOUR{Math.abs(daysUntil) > 1 ? "S" : ""}
        </div>
      ) : (
        <p className="text-slate-500 text-xs mb-3">Dans {daysUntil} jour{daysUntil > 1 ? "s" : ""}</p>
      )}
      <div className="text-[10px] text-slate-500 space-y-0.5 mb-4">
        {principal === 0 && interest === 0 && amount > 0 ? (
          <div>Frais de dossier (date de mise en place)</div>
        ) : (
          <>
            <div>Capital: {formatCFA(principal)} · Intérêts: {formatCFA(interest)}</div>
            {insurance > 0 && <div>Assurance: {formatCFA(insurance)}</div>}
          </>
        )}
      </div>
      <button
        onClick={() => {
          const amt = customAmount !== "" && !isNaN(parseInt(customAmount, 10)) ? parseInt(customAmount, 10) : undefined;
          onMarkPaid(amt);
        }}
        disabled={loading || !isValidAmount}
        className={`w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
          isOverdue ? "bg-red-500/30 hover:bg-red-500/40 text-red-200" : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300"
        }`}
      >
        {loading ? (
          "..."
        ) : (
          <>
            <Check size={16} /> Marquer comme payé
          </>
        )}
      </button>
    </div>
  );
}
