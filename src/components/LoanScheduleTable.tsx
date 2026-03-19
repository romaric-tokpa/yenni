"use client";
import { useState, useMemo } from "react";
import { formatCFA } from "@/lib/constants";
import { Check, AlertTriangle, RotateCcw, Pencil, X } from "lucide-react";
import type { LoanScheduleRow } from "@/lib/types";

type Filter = "all" | "paid" | "overdue" | "upcoming";

type ScheduleRowUpdate = Partial<Pick<LoanScheduleRow, "due_date" | "principal" | "interest" | "insurance" | "tax_interest" | "tax_insurance" | "fees" | "total_payment" | "remaining_balance" | "paid_amount">>;

interface LoanScheduleTableProps {
  schedule: LoanScheduleRow[];
  nextDueNumber: number | null;
  onMarkPaid: (number: number, note?: string, amount?: number) => Promise<void>;
  onMarkUnpaid: (number: number) => Promise<void>;
  onUpdateRow: (number: number, updates: ScheduleRowUpdate) => Promise<boolean>;
  onScheduleUpdated?: () => void;
  loading?: boolean;
}

export default function LoanScheduleTable({
  schedule,
  nextDueNumber,
  onMarkPaid,
  onMarkUnpaid,
  onUpdateRow,
  onScheduleUpdated,
  loading = false,
}: LoanScheduleTableProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [payNote, setPayNote] = useState<Record<number, string>>({});
  const [payAmount, setPayAmount] = useState<Record<number, string>>({});
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ScheduleRowUpdate>({});
  const [saving, setSaving] = useState(false);

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
              <th className="p-2 font-medium hidden sm:table-cell">Capital</th>
              <th className="p-2 font-medium hidden md:table-cell">Intérêts</th>
              <th className="p-2 font-medium hidden lg:table-cell">Taxes</th>
              <th className="p-2 font-medium hidden lg:table-cell">Assurance</th>
              <th className="p-2 font-medium hidden sm:table-cell">Frais</th>
              <th className="p-2 font-medium">Montant</th>
              <th className="p-2 font-medium">Reste dû</th>
              <th className="p-2 font-medium">Statut</th>
              <th className="p-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const isEditing = editingRow === row.number;
              const form = isEditing ? editForm : {};
              const getVal = (k: keyof ScheduleRowUpdate) => form[k] ?? row[k];
              return (
              <tr key={row.number} className={`border-t border-white/5 ${getRowClass(row)} ${isEditing ? "bg-blue-500/5" : ""}`}>
                <td className="p-2 font-mono">{row.number}</td>
                <td className="p-2">
                  {isEditing ? (
                    <input
                      type="date"
                      value={String(getVal("due_date") ?? row.due_date).slice(0, 10)}
                      onChange={(e) => setEditForm((f) => ({ ...f, due_date: e.target.value }))}
                      className="input-field !text-[10px] !py-1 !h-7 w-24"
                    />
                  ) : (
                    formatDate(row.due_date)
                  )}
                </td>
                <td className="p-2 font-mono text-emerald-400 hidden sm:table-cell">
                  {isEditing ? (
                    <input
                      type="number"
                      value={getVal("principal") ?? row.principal}
                      onChange={(e) => setEditForm((f) => ({ ...f, principal: parseInt(e.target.value, 10) || 0 }))}
                      className="input-field !text-[10px] !py-1 !h-7 w-16 font-mono"
                    />
                  ) : (
                    formatCFA(row.principal)
                  )}
                </td>
                <td className="p-2 font-mono text-red-400 hidden md:table-cell">
                  {isEditing ? (
                    <input
                      type="number"
                      value={getVal("interest") ?? row.interest}
                      onChange={(e) => setEditForm((f) => ({ ...f, interest: parseInt(e.target.value, 10) || 0 }))}
                      className="input-field !text-[10px] !py-1 !h-7 w-16 font-mono"
                    />
                  ) : (
                    formatCFA(row.interest)
                  )}
                </td>
                <td className="p-2 font-mono text-amber-400/90 hidden lg:table-cell">
                  {isEditing ? (
                    <div className="flex gap-0.5">
                      <input
                        type="number"
                        placeholder="Taxe int."
                        value={getVal("tax_interest") ?? row.tax_interest}
                        onChange={(e) => setEditForm((f) => ({ ...f, tax_interest: parseInt(e.target.value, 10) || 0 }))}
                        className="input-field !text-[10px] !py-1 !h-7 w-14 font-mono"
                      />
                      <input
                        type="number"
                        placeholder="Taxe ass."
                        value={getVal("tax_insurance") ?? row.tax_insurance}
                        onChange={(e) => setEditForm((f) => ({ ...f, tax_insurance: parseInt(e.target.value, 10) || 0 }))}
                        className="input-field !text-[10px] !py-1 !h-7 w-14 font-mono"
                      />
                    </div>
                  ) : (
                    formatCFA(row.tax_interest + row.tax_insurance)
                  )}
                </td>
                <td className="p-2 font-mono text-slate-400 hidden lg:table-cell">
                  {isEditing ? (
                    <input
                      type="number"
                      value={getVal("insurance") ?? row.insurance}
                      onChange={(e) => setEditForm((f) => ({ ...f, insurance: parseInt(e.target.value, 10) || 0 }))}
                      className="input-field !text-[10px] !py-1 !h-7 w-16 font-mono"
                    />
                  ) : (
                    formatCFA(row.insurance)
                  )}
                </td>
                <td className="p-2 font-mono text-slate-400 hidden sm:table-cell">
                  {isEditing ? (
                    <input
                      type="number"
                      value={getVal("fees") ?? row.fees}
                      onChange={(e) => setEditForm((f) => ({ ...f, fees: parseInt(e.target.value, 10) || 0 }))}
                      className="input-field !text-[10px] !py-1 !h-7 w-16 font-mono"
                    />
                  ) : (
                    formatCFA(row.fees)
                  )}
                </td>
                <td className="p-2 font-mono font-medium">
                  {isEditing ? (
                    <input
                      type="number"
                      value={row.status === "paid" ? (getVal("paid_amount") ?? row.paid_amount ?? row.total_payment) : (getVal("total_payment") ?? row.total_payment)}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10) || 0;
                        if (row.status === "paid") setEditForm((f) => ({ ...f, paid_amount: v }));
                        else setEditForm((f) => ({ ...f, total_payment: v }));
                      }}
                      className="input-field !text-[10px] !py-1 !h-7 w-20 font-mono"
                    />
                  ) : (
                    row.status === "paid" && row.paid_amount != null
                      ? formatCFA(row.paid_amount)
                      : formatCFA(row.total_payment)
                  )}
                </td>
                <td className="p-2 font-mono">
                  {isEditing ? (
                    <input
                      type="number"
                      value={getVal("remaining_balance") ?? row.remaining_balance}
                      onChange={(e) => setEditForm((f) => ({ ...f, remaining_balance: parseInt(e.target.value, 10) || 0 }))}
                      className="input-field !text-[10px] !py-1 !h-7 w-20 font-mono"
                    />
                  ) : (
                    formatCFA(row.remaining_balance)
                  )}
                </td>
                <td className="p-2">{getStatusBadge(row)}</td>
                <td className="p-2">
                  {isEditing ? (
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={async () => {
                          setSaving(true);
                          const ok = await onUpdateRow(row.number, editForm);
                          setSaving(false);
                          if (ok) {
                            setEditingRow(null);
                            setEditForm({});
                            onScheduleUpdated?.();
                          }
                        }}
                        disabled={saving}
                        className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold"
                      >
                        {saving ? "..." : <><Check size={10} /> Enregistrer</>}
                      </button>
                      <button
                        onClick={() => { setEditingRow(null); setEditForm({}); }}
                        disabled={saving}
                        className="px-1.5 py-0.5 rounded-md bg-slate-500/20 text-slate-400 text-[10px]"
                      >
                        <X size={10} className="inline" /> Annuler
                      </button>
                    </div>
                  ) : (
                    <>
                  <button
                    onClick={() => { setEditingRow(row.number); setEditForm({ due_date: row.due_date, principal: row.principal, interest: row.interest, tax_interest: row.tax_interest, tax_insurance: row.tax_insurance, insurance: row.insurance, fees: row.fees, total_payment: row.total_payment, remaining_balance: row.remaining_balance, paid_amount: row.paid_amount ?? undefined }); }}
                    className="px-1.5 py-0.5 rounded-md bg-slate-500/20 text-slate-400 hover:text-slate-300 text-[10px] mr-1"
                    title="Modifier les montants"
                  >
                    <Pencil size={10} className="inline" />
                  </button>
                  {row.status === "paid" && (
                    <button
                      onClick={() => onMarkUnpaid(row.number)}
                      disabled={loading}
                      className="px-1.5 py-0.5 rounded-md bg-slate-500/20 text-slate-400 hover:text-slate-300 text-[10px]"
                    >
                      <RotateCcw size={10} className="inline" /> Annuler
                    </button>
                  )}
                  </>
                  )}
                  {row.status === "overdue" && !isEditing && (
                    <div className="flex flex-col gap-1">
                      <input
                        type="number"
                        placeholder="Montant facturé"
                        value={payAmount[row.number] ?? String(row.total_payment)}
                        onChange={(e) => setPayAmount((p) => ({ ...p, [row.number]: e.target.value }))}
                        className="input-field !text-[10px] !py-1 !h-7 w-20 font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Note (opt.)"
                        value={payNote[row.number] ?? ""}
                        onChange={(e) => setPayNote((p) => ({ ...p, [row.number]: e.target.value }))}
                        className="input-field !text-[10px] !py-1 !h-7 w-20"
                      />
                      <button
                        onClick={() => {
                          const amt = payAmount[row.number] != null ? parseInt(String(payAmount[row.number]), 10) : undefined;
                          onMarkPaid(row.number, payNote[row.number] || undefined, !isNaN(amt as number) ? amt : undefined);
                        }}
                        disabled={loading}
                        className="px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[10px] font-semibold w-fit"
                      >
                        Payer
                      </button>
                    </div>
                  )}
                  {row.number === nextDueNumber && row.status !== "paid" && !isEditing && (
                    <div className="flex flex-col gap-1">
                      <input
                        type="number"
                        placeholder="Montant facturé"
                        value={payAmount[row.number] ?? String(row.total_payment)}
                        onChange={(e) => setPayAmount((p) => ({ ...p, [row.number]: e.target.value }))}
                        className="input-field !text-[10px] !py-1 !h-7 w-20 font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Note (opt.)"
                        value={payNote[row.number] ?? ""}
                        onChange={(e) => setPayNote((p) => ({ ...p, [row.number]: e.target.value }))}
                        className="input-field !text-[10px] !py-1 !h-7 w-20"
                      />
                      <button
                        onClick={() => {
                          const amt = payAmount[row.number] != null ? parseInt(String(payAmount[row.number]), 10) : undefined;
                          onMarkPaid(row.number, payNote[row.number] || undefined, !isNaN(amt as number) ? amt : undefined);
                        }}
                        disabled={loading}
                        className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-semibold flex items-center gap-1 w-fit"
                      >
                        <Check size={10} /> Payer
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
