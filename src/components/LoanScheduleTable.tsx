"use client";
import { useState, useMemo } from "react";
import { formatCFA } from "@/lib/constants";
import { Check, AlertTriangle, RotateCcw } from "lucide-react";
import type { LoanScheduleRow } from "@/lib/types";

type Filter = "all" | "paid" | "overdue" | "upcoming";

interface LoanScheduleTableProps {
  schedule: LoanScheduleRow[];
  nextDueNumber: number | null;
  onMarkPaid: (number: number, note?: string) => Promise<void>;
  onMarkUnpaid: (number: number) => Promise<void>;
  loading?: boolean;
}

export default function LoanScheduleTable({
  schedule,
  nextDueNumber,
  onMarkPaid,
  onMarkUnpaid,
  loading = false,
}: LoanScheduleTableProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [payNote, setPayNote] = useState<Record<number, string>>({});

  const filtered = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    switch (filter) {
      case "paid":
        return schedule.filter((s) => s.status === "paid");
      case "overdue":
        return schedule.filter((s) => s.status === "overdue");
      case "upcoming":
        return schedule.filter((s) => s.status === "pending" || s.status === "upcoming");
      default:
        return schedule;
    }
  }, [schedule, filter]);

  const counts = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return {
      all: schedule.length,
      paid: schedule.filter((s) => s.status === "paid").length,
      overdue: schedule.filter((s) => s.status === "overdue").length,
      upcoming: schedule.filter((s) => s.status === "pending" || s.status === "upcoming").length,
    };
  }, [schedule]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

  const getRowClass = (row: LoanScheduleRow) => {
    if (row.status === "paid") return "opacity-60";
    if (row.status === "overdue") return "bg-red-500/10";
    if (row.number === nextDueNumber) return "bg-blue-500/10";
    return "";
  };

  const getStatusBadge = (row: LoanScheduleRow) => {
    if (row.status === "paid") {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px]">
          <Check size={10} /> Payé
          {row.paid_at && (
            <span className="text-slate-500">
              {new Date(row.paid_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
            </span>
          )}
        </span>
      );
    }
    if (row.status === "overdue") {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-500/20 text-red-400 text-[10px] animate-pulse">
          <AlertTriangle size={10} /> En retard
        </span>
      );
    }
    if (row.number === nextDueNumber) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[10px]">
          → À payer
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-500/20 text-slate-400 text-[10px]">
        À venir
      </span>
    );
  };

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="p-3 border-b border-white/5 flex flex-wrap gap-2">
        {(["all", "paid", "overdue", "upcoming"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
              filter === f
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {f === "all" && "Tout"}
            {f === "paid" && `Payées (${counts.paid})`}
            {f === "overdue" && `En retard (${counts.overdue})`}
            {f === "upcoming" && `À venir (${counts.upcoming})`}
          </button>
        ))}
      </div>
      <div className="max-h-[500px] overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-900/95 backdrop-blur z-10">
            <tr className="text-slate-500 text-[10px]">
              <th className="p-2 font-medium">N°</th>
              <th className="p-2 font-medium">Date</th>
              <th className="p-2 font-medium">Mensualité</th>
              <th className="p-2 font-medium">Capital</th>
              <th className="p-2 font-medium">Intérêts</th>
              <th className="p-2 font-medium">Reste dû</th>
              <th className="p-2 font-medium">Statut</th>
              <th className="p-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.number} className={`border-t border-white/5 ${getRowClass(row)}`}>
                <td className="p-2 font-mono">{row.number}</td>
                <td className="p-2">{formatDate(row.due_date)}</td>
                <td className="p-2 font-mono">{formatCFA(row.total_payment)}</td>
                <td className="p-2 font-mono text-emerald-400">{formatCFA(row.principal)}</td>
                <td className="p-2 font-mono text-red-400">{formatCFA(row.interest)}</td>
                <td className="p-2 font-mono">{formatCFA(row.remaining_balance)}</td>
                <td className="p-2">{getStatusBadge(row)}</td>
                <td className="p-2">
                  {row.status === "paid" && (
                    <button
                      onClick={() => onMarkUnpaid(row.number)}
                      disabled={loading}
                      className="px-1.5 py-0.5 rounded-md bg-slate-500/20 text-slate-400 hover:text-slate-300 text-[10px]"
                    >
                      <RotateCcw size={10} className="inline" /> Annuler
                    </button>
                  )}
                  {row.status === "overdue" && (
                    <button
                      onClick={() => onMarkPaid(row.number)}
                      disabled={loading}
                      className="px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[10px] font-semibold"
                    >
                      Payer
                    </button>
                  )}
                  {row.number === nextDueNumber && row.status !== "paid" && (
                    <div className="flex flex-col gap-1">
                      <input
                        type="text"
                        placeholder="Note (optionnel)"
                        value={payNote[row.number] ?? ""}
                        onChange={(e) => setPayNote((p) => ({ ...p, [row.number]: e.target.value }))}
                        className="input-field !text-[10px] !py-1 !h-7 w-24"
                      />
                      <button
                        onClick={() => onMarkPaid(row.number, payNote[row.number] || undefined)}
                        disabled={loading}
                        className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-semibold flex items-center gap-1 w-fit"
                      >
                        <Check size={10} /> Payer
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
