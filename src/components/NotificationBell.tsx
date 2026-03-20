"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useBudgetContext } from "@/contexts/BudgetContext";
import { Bell, Check, HandCoins, Receipt, RefreshCw, X, Heart, ShoppingCart, Coins } from "lucide-react";
import { formatCFA } from "@/lib/constants";
import type { NotificationTodo } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : []));

export default function NotificationBell({ showToast }: { showToast: (m: string, t?: string) => void }) {
  const { executePlannedExpense, refreshAll } = useBudgetContext();
  const { data: todos = [], mutate } = useSWR<NotificationTodo[]>("/api/notifications", fetcher, {
    refreshInterval: 60 * 1000,
    revalidateOnFocus: true,
    dedupingInterval: 10000,
  });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payingSchedule, setPayingSchedule] = useState<{ loanId: number; number: number; defaultAmount: number } | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const refreshTodos = useCallback(() => mutate(), [mutate]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [open]);

  const handleValidatePlanned = async (id: number) => {
    setLoading(true);
    try {
      const ok = await executePlannedExpense(id);
      if (ok) {
        showToast("Dépense planifiée validée !");
        setOpen(false);
        await refreshTodos();
      } else {
        showToast("Erreur ou déjà exécutée", "error");
      }
    } catch {
      showToast("Erreur réseau", "error");
    }
    setLoading(false);
  };

  const handlePayLoan = (loanId: number) => {
    setOpen(false);
    router.push(`/loans?pay=${loanId}`);
  };

  const handlePaySchedule = async (loanId: number, scheduleNumber: number, defaultAmount: number) => {
    setPayingSchedule({ loanId, number: scheduleNumber, defaultAmount });
    setPayAmount(String(defaultAmount));
  };

  const handleConfirmPaySchedule = async () => {
    if (!payingSchedule) return;
    setLoading(true);
    try {
      const parsed = parseInt(payAmount.replace(/\s/g, ""), 10);
      const amount = !isNaN(parsed) && parsed > 0 ? parsed : undefined;
      const body: Record<string, unknown> = {
        loan_id: payingSchedule.loanId,
        number: payingSchedule.number,
        action: "pay",
      };
      if (amount != null && !isNaN(amount) && amount > 0) body.amount = amount;

      const r = await fetch("/api/loan-schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        showToast("Échéance marquée comme payée !");
        setOpen(false);
        setPayingSchedule(null);
        setPayAmount("");
        await Promise.all([refreshTodos(), refreshAll()]);
      } else {
        const data = await r.json().catch(() => ({}));
        showToast(data.error || "Erreur", "error");
      }
    } catch {
      showToast("Erreur réseau", "error");
    }
    setLoading(false);
  };

  const handleViewLoan = (loanId: number) => {
    setOpen(false);
    router.push(`/loans?view=${loanId}`);
  };

  const dueLabel = (t: NotificationTodo) => {
    if (t.is_overdue) return { text: "En retard", cls: "text-red-400" };
    if (t.days_left === 0) return { text: "Aujourd'hui", cls: "text-amber-400" };
    if (t.days_left === 1) return { text: "Demain", cls: "text-amber-300" };
    return { text: `Dans ${t.days_left}j`, cls: "text-slate-400" };
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

  const hasOverdue = todos.some((t) => t.is_overdue);
  const hasUpcoming = todos.some((t) => (t.source_type === "loan_upcoming" || t.source_type === "loan_due" || t.source_type === "change_encash") && !t.is_overdue);

  const renderTodoItem = (t: NotificationTodo) => {
    const dl = dueLabel(t);
    const goTo = () => {
      setOpen(false);
      router.push(t.link);
    };
    const iconClass =
      t.source_type === "loan_overdue"
        ? "bg-red-500/20 text-red-400"
        : t.source_type === "loan_upcoming"
          ? "bg-amber-500/20 text-amber-400"
          : t.source_type === "change_encash"
            ? "bg-amber-500/20 text-amber-400"
            : t.source_type === "loan_due"
              ? "bg-teal-500/20 text-teal-400"
              : t.source_type === "wish"
              ? "bg-pink-500/20 text-pink-400"
              : t.source_type === "shopping"
                ? "bg-amber-500/20 text-amber-400"
                : "bg-amber-500/20 text-amber-400";
    const actionBtn =
      t.source_type === "wish" || t.source_type === "shopping" ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goTo();
          }}
          className="px-2.5 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 text-[11px] font-semibold transition-colors"
        >
          Voir
        </button>
      ) : t.source_type === "loan_overdue" && t.loan_id != null && t.schedule_number != null ? (
        payingSchedule?.loanId === t.loan_id && payingSchedule?.number === t.schedule_number ? (
          <div className="flex flex-col gap-1.5 min-w-[120px]">
            <input
              type="number"
              placeholder="Montant facturé (FCFA)"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="input-field !text-[10px] !py-1.5 !h-8 w-full font-mono"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleConfirmPaySchedule();
                }}
                disabled={loading}
                className="flex-1 px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-semibold"
              >
                {loading ? "..." : "Confirmer"}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPayingSchedule(null);
                  setPayAmount("");
                }}
                className="px-2 py-1 rounded-lg bg-slate-500/20 text-slate-400 text-[10px]"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePaySchedule(t.loan_id!, t.schedule_number!, t.amount ?? 0);
            }}
            disabled={loading}
            className="px-2.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[11px] font-semibold transition-colors"
          >
            {loading ? "..." : "Payer maintenant"}
          </button>
        )
      ) : t.source_type === "loan_upcoming" && t.loan_id != null ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleViewLoan(t.loan_id!);
          }}
          className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-semibold transition-colors"
        >
          Voir
        </button>
      ) : t.source_type === "planned_expense" ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleValidatePlanned(t.source_id);
          }}
          disabled={loading}
          className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-semibold transition-colors"
        >
          {loading ? "..." : "Valider"}
        </button>
      ) : t.source_type === "change_encash" ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePayLoan(t.source_id);
          }}
          className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-semibold transition-colors"
        >
          {t.action_label ?? "Encaisser"}
        </button>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePayLoan(t.source_id);
          }}
          className="px-2.5 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-[11px] font-semibold transition-colors"
        >
          Payer
        </button>
      );
    return (
      <li key={t.id} className="p-3 hover:bg-white/[0.03] transition-colors">
        <div className="flex gap-3">
          <button type="button" onClick={goTo} className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${iconClass} hover:opacity-80 transition-opacity`}>
            {t.source_type === "change_encash" ? (
              <Coins size={18} />
            ) : t.source_type === "loan_due" || t.source_type === "loan_overdue" || t.source_type === "loan_upcoming" ? (
              <HandCoins size={18} />
            ) : t.source_type === "wish" ? (
              <Heart size={18} />
            ) : t.source_type === "shopping" ? (
              <ShoppingCart size={18} />
            ) : (
              <Receipt size={18} />
            )}
          </button>
          <button type="button" onClick={goTo} className="flex-1 min-w-0 text-left cursor-pointer">
            <p className="text-xs font-medium text-slate-300 truncate">{t.title}</p>
            <p className="text-sm font-semibold text-slate-100 truncate">{t.message}</p>
            {t.amount != null && (
              <p className="text-xs font-mono text-emerald-400 mt-0.5">
                {formatCFA(t.amount)} FCFA
              </p>
            )}
            <p className={`text-[10px] mt-1 ${dl.cls}`}>
              {dl.text} · {formatDate(t.due_date)}
            </p>
          </button>
          <div className="flex flex-col gap-1 shrink-0">{actionBtn}</div>
        </div>
      </li>
    );
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl glass border border-white/10 hover:bg-white/5 text-slate-300 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {todos.length > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1 ${
              hasOverdue ? "bg-red-500" : hasUpcoming ? "bg-amber-500" : "bg-emerald-500"
            }`}
          >
            {todos.length > 9 ? "9+" : todos.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(340px,calc(100vw-2rem))] popup-panel rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="p-3 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Bell size={16} className="text-emerald-400" />
              À faire
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => refreshTodos()}
                className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors"
                title="Actualiser"
                aria-label="Actualiser les notifications"
              >
                <RefreshCw size={14} />
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500" aria-label="Fermer">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="max-h-[min(400px,65vh)] overflow-y-auto">
            {todos.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                  <Check size={24} className="text-emerald-500/60" />
                </div>
                <p className="font-medium text-slate-400">Tout est à jour</p>
                <p className="text-xs mt-1">Aucune action en attente</p>
              </div>
            ) : (
              <div className="p-2">
                <ul className="divide-y divide-white/5">{todos.map(renderTodoItem)}</ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
