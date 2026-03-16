"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useBudgetContext } from "@/contexts/BudgetContext";
import { Bell, Check, HandCoins, Receipt, X } from "lucide-react";
import { formatCFA } from "@/lib/constants";
import type { NotificationTodo } from "@/lib/types";

export default function NotificationBell({ showToast }: { showToast: (m: string, t?: string) => void }) {
  const { executePlannedExpense } = useBudgetContext();
  const [todos, setTodos] = useState<NotificationTodo[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchTodos = async () => {
    try {
      const r = await fetch("/api/notifications");
      if (r.ok) setTodos(await r.json());
    } catch {
      setTodos([]);
    }
  };

  useEffect(() => {
    fetchTodos();
    const interval = setInterval(fetchTodos, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleValidatePlanned = async (id: number) => {
    setLoading(true);
    try {
      const ok = await executePlannedExpense(id);
      if (ok) {
        showToast("Dépense planifiée validée !");
        setOpen(false);
        await fetchTodos();
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

  const dueLabel = (t: NotificationTodo) => {
    if (t.is_overdue) return { text: "En retard", cls: "text-red-400" };
    if (t.days_left === 0) return { text: "Aujourd'hui", cls: "text-amber-400" };
    if (t.days_left === 1) return { text: "Demain", cls: "text-amber-300" };
    return { text: `Dans ${t.days_left}j`, cls: "text-slate-400" };
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl glass border border-white/10 hover:bg-white/5 text-slate-300 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {todos.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
            {todos.length > 9 ? "9+" : todos.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(340px,calc(100vw-2rem))] glass-strong rounded-2xl border border-white/10 shadow-xl z-50 overflow-hidden">
          <div className="p-3 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Bell size={16} className="text-emerald-400" />
              À faire
            </h3>
            <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-white/5 text-slate-500">
              <X size={16} />
            </button>
          </div>

          <div className="max-h-[min(360px,60vh)] overflow-y-auto">
            {todos.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                <Check size={32} className="mx-auto mb-2 text-emerald-500/50" />
                Aucune action en attente
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {todos.map((t) => {
                  const dl = dueLabel(t);
                  const goTo = () => {
                    setOpen(false);
                    router.push(t.link);
                  };
                  return (
                    <li key={t.id} className="p-3 hover:bg-white/[0.03] transition-colors">
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={goTo}
                          className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
                            t.source_type === "loan_due"
                              ? "bg-teal-500/20 text-teal-400"
                              : "bg-amber-500/20 text-amber-400"
                          } hover:opacity-80 transition-opacity`}
                        >
                          {t.source_type === "loan_due" ? (
                            <HandCoins size={18} />
                          ) : (
                            <Receipt size={18} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={goTo}
                          className="flex-1 min-w-0 text-left cursor-pointer"
                        >
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
                        <div className="flex flex-col gap-1 shrink-0">
                          {t.source_type === "planned_expense" ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleValidatePlanned(t.source_id); }}
                              disabled={loading}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-semibold transition-colors"
                            >
                              {loading ? "..." : "Valider"}
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handlePayLoan(t.source_id); }}
                              className="px-2.5 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-[11px] font-semibold transition-colors"
                            >
                              Payer
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
