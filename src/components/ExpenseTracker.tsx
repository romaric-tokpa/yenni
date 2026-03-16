"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatCFA, MONTHS_FULL, VIRTUAL_LIST_THRESHOLD } from "@/lib/constants";
import { BudgetConfig, Expense, FixedChargePayment, Category, PlannedExpense } from "@/lib/types";
import { Plus, Trash2, X, FileText, Check, Landmark, CalendarClock, Clock, CircleCheck, Pencil, CirclePlay, History, Calendar, ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react";
import { exportExpensesCSV } from "@/lib/exportUtils";
import Icon from "./ui/Icon";
import VirtualList from "./VirtualList";

type HistoryItem =
  | { kind: "expense"; data: Expense }
  | { kind: "fixed"; data: FixedChargePayment };

interface BudgetData {
  config: BudgetConfig;
  expenses: Expense[];
  fixedPayments: FixedChargePayment[];
  plannedExpenses: PlannedExpense[];
  selectedMonth: number;
  selectedYear: number;
  setSelectedMonth: (m: number) => void;
  setSelectedYear: (y: number) => void;
  addExpense: (exp: Omit<Expense, "id" | "created_at">) => Promise<boolean>;
  updateExpense: (id: number, updates: Partial<Omit<Expense, "id" | "created_at">>) => Promise<boolean>;
  removeExpense: (id: number) => Promise<void>;
  removeFixedPayment: (id: number) => Promise<void>;
  addPlannedExpense: (p: Omit<PlannedExpense, "id" | "created_at" | "expense_id">) => Promise<boolean>;
  updatePlannedExpense: (id: number, updates: Partial<PlannedExpense>) => Promise<void>;
  removePlannedExpense: (id: number) => Promise<void>;
  executePlannedExpense: (id: number) => Promise<boolean>;
  totalMonthSpent: number;
  totalFixed: number;
  totalBudgetVar: number;
}

export default function ExpenseTracker({
  budget,
  showToast,
}: {
  budget: BudgetData;
  showToast: (m: string, t?: string) => void;
}) {
  const {
    config,
    expenses,
    fixedPayments,
    plannedExpenses,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    addExpense,
    updateExpense,
    removeExpense,
    removeFixedPayment,
    addPlannedExpense,
    updatePlannedExpense,
    removePlannedExpense,
    executePlannedExpense,
    totalMonthSpent,
    totalFixed,
    totalBudgetVar,
  } = budget;

  const allHistory: HistoryItem[] = [
    ...expenses.map((e) => ({ kind: "expense" as const, data: e })),
    ...fixedPayments.map((p) => ({ kind: "fixed" as const, data: p })),
  ].sort((a, b) => {
    const da = `${a.data.date} ${a.data.time}`;
    const db = `${b.data.date} ${b.data.time}`;
    return db.localeCompare(da);
  });
  const totalAllSpent = totalMonthSpent + totalFixed;
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);

  const pendingPlanned = useMemo(() => plannedExpenses.filter((p) => p.status === "pending"), [plannedExpenses]);
  const executedPlanned = useMemo(() => plannedExpenses.filter((p) => p.status === "executed"), [plannedExpenses]);

  const searchParams = useSearchParams();
  const router = useRouter();
  const plannedSectionRef = useRef<HTMLDivElement>(null);
  const [highlightedPlannedId, setHighlightedPlannedId] = useState<number | null>(null);

  useEffect(() => {
    const plannedId = searchParams.get("planned");
    if (plannedId && plannedExpenses.length > 0) {
      const id = parseInt(plannedId, 10);
      const p = plannedExpenses.find((x) => x.id === id);
      if (p && p.status === "pending") {
        setHighlightedPlannedId(id);
        plannedSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        router.replace("/expenses", { scroll: false });
        const t = setTimeout(() => setHighlightedPlannedId(null), 3000);
        return () => clearTimeout(t);
      }
    }
  }, [searchParams, plannedExpenses, router]);

  const planDefault = {
    due_date: "",
    description: "",
    category: config.categories[0]?.id || "food",
    amount: "",
    notes: "",
  };
  const [planForm, setPlanForm] = useState(planDefault);
  const [editingPlanned, setEditingPlanned] = useState<PlannedExpense | null>(null);
  const now = new Date();
  const [form, setForm] = useState({
    date: now.toISOString().split("T")[0],
    time: now.toTimeString().slice(0, 5),
    description: "",
    category: config.categories[0]?.id || "food",
    amount: "",
    notes: "",
  });

  const handleSubmit = async () => {
    if (!form.description || !form.amount || Number(form.amount) <= 0) {
      showToast("Remplis tous les champs", "error");
      return;
    }
    if (editingExpense) {
      const ok = await updateExpense(editingExpense.id, {
        date: form.date,
        time: form.time || "00:00",
        description: form.description,
        category: form.category,
        amount: Number(form.amount),
        notes: form.notes,
      });
      if (ok) {
        showToast("Dépense modifiée !");
        closeExpenseModal();
      }
    } else {
      const ok = await addExpense({ ...form, amount: Number(form.amount), time: form.time || "00:00" });
      if (ok) {
        showToast("Dépense enregistrée !");
        closeExpenseModal();
      }
    }
  };

  const closeExpenseModal = () => {
    const n = new Date();
    setForm({
      date: n.toISOString().split("T")[0],
      time: n.toTimeString().slice(0, 5),
      description: "",
      category: config.categories[0]?.id || "food",
      amount: "",
      notes: "",
    });
    setEditingExpense(null);
    setShowModal(false);
  };

  const handleEditExpense = (exp: Expense) => {
    setForm({
      date: exp.date,
      time: exp.time || "00:00",
      description: exp.description,
      category: exp.category,
      amount: String(exp.amount),
      notes: exp.notes || "",
    });
    setEditingExpense(exp);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    await removeExpense(id);
    showToast("Dépense supprimée", "info");
  };

  const handleExecutePlanned = async (id: number) => {
    const ok = await executePlannedExpense(id);
    if (ok) showToast("Dépense validée et enregistrée !");
    else showToast("Erreur lors de la validation", "error");
  };

  const handleEditPlanned = (p: PlannedExpense) => {
    setPlanForm({
      due_date: p.due_date,
      description: p.description,
      category: p.category,
      amount: String(p.amount),
      notes: p.notes,
    });
    setEditingPlanned(p);
    setShowPlanModal(true);
  };

  const handleSavePlan = async () => {
    if (!planForm.due_date || !planForm.description || !planForm.amount || Number(planForm.amount) <= 0) {
      showToast("Remplis tous les champs", "error");
      return;
    }
    if (editingPlanned) {
      await updatePlannedExpense(editingPlanned.id, {
        due_date: planForm.due_date,
        description: planForm.description,
        category: planForm.category,
        amount: Number(planForm.amount),
        notes: planForm.notes,
      });
      showToast("Dépense planifiée modifiée !");
    } else {
      const ok = await addPlannedExpense({
        due_date: planForm.due_date,
        description: planForm.description,
        category: planForm.category,
        amount: Number(planForm.amount),
        notes: planForm.notes,
        status: "pending",
      });
      if (ok) showToast("Dépense planifiée !");
    }
    setPlanForm(planDefault);
    setEditingPlanned(null);
    setShowPlanModal(false);
  };

  const closePlanModal = () => {
    setShowPlanModal(false);
    setEditingPlanned(null);
    setPlanForm(planDefault);
  };

  const getDueLabel = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateStr);
    due.setHours(0, 0, 0, 0);
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: "En retard", cls: "text-red-400" };
    if (diff === 0) return { text: "Aujourd'hui", cls: "text-amber-400" };
    if (diff === 1) return { text: "Demain", cls: "text-amber-300" };
    if (diff <= 7) return { text: `Dans ${diff}j`, cls: "text-blue-400" };
    return { text: `Dans ${diff}j`, cls: "text-slate-400" };
  };

  return (
    <div className="animate-slide-up">
      <div className="flex flex-col gap-3 mb-5 lg:mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold">Suivi des Dépenses</h1>
            <p className="text-slate-500 text-xs lg:text-sm mt-0.5">
              {allHistory.length} transactions en {MONTHS_FULL[selectedMonth]} {selectedYear}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary min-h-[44px] px-4 py-2.5 lg:px-5 rounded-xl text-xs lg:text-sm font-semibold flex items-center gap-1.5 shrink-0 touch-manipulation"
          >
            <Plus size={16} /> <span className="hidden sm:inline">Nouvelle</span> Dépense
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <select
          className="input-field w-full sm:w-36"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
        >
          {MONTHS_FULL.map((m, i) => (
            <option key={i} value={i}>{m}</option>
          ))}
        </select>
        <select
          className="input-field w-24"
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
        >
          {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button
          onClick={() => exportExpensesCSV(expenses, fixedPayments, selectedMonth, selectedYear, config.categories)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold transition-colors"
          title="Exporter les dépenses en CSV/Excel"
        >
          <FileSpreadsheet size={14} />
          CSV
        </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-4 mb-5 lg:mb-6">
        {[
          { label: "Dépenses var.", value: formatCFA(totalMonthSpent), color: "text-amber-400" },
          { label: "Charges fixes", value: formatCFA(totalFixed), color: "text-orange-400" },
          { label: "Total sorties", value: formatCFA(totalAllSpent), color: "text-red-300" },
          { label: "Reste budget", value: formatCFA(totalBudgetVar - totalMonthSpent), color: totalBudgetVar - totalMonthSpent >= 0 ? "text-emerald-400" : "text-red-400" },
        ].map((s, i) => (
          <div key={i} className="glass rounded-xl lg:rounded-2xl p-3 lg:p-5 text-center">
            <div className="text-[9px] lg:text-[11px] text-slate-500">{s.label}</div>
            <div className={`font-mono text-sm lg:text-xl font-bold mt-0.5 lg:mt-1 ${s.color}`}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table — scroll horizontal sur tablette */}
      <div className="hidden md:block glass-strong rounded-2xl overflow-x-auto">
        <div className="min-w-[580px]">
        <div className="grid grid-cols-[100px_1fr_160px_120px_70px] px-5 py-3 bg-amber-500/10 border-b border-white/5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          <div>Date</div>
          <div>Description</div>
          <div>Type</div>
          <div className="text-right">Montant</div>
          <div />
        </div>
        {allHistory.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <div className="mb-3 flex justify-center">
              <FileText size={36} className="text-slate-600" />
            </div>
            Aucune transaction pour {MONTHS_FULL[selectedMonth]}
          </div>
        ) : allHistory.length > VIRTUAL_LIST_THRESHOLD ? (
          <VirtualList
            items={allHistory}
            estimateSize={48}
            maxHeight="50vh"
            getItemKey={(item) => (item.kind === "expense" ? `e-${item.data.id}` : `f-${item.data.id}`)}
            renderItem={(item) => {
              if (item.kind === "expense") {
                const exp = item.data;
                const cat = config.categories.find((c: Category) => c.id === exp.category);
                return (
                  <div className="expense-row grid grid-cols-[100px_1fr_160px_120px_70px] px-5 py-3.5 items-center border-b border-white/[0.03]">
                    <div className="font-mono text-xs text-slate-400">
                      <div>{new Date(exp.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</div>
                      {exp.time && exp.time !== "00:00" && <div className="text-[10px] text-slate-500">{exp.time}</div>}
                    </div>
                    <div className="text-[13px]">{exp.description}</div>
                    <div>
                      <span className="text-[11px] font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1"
                        style={{ background: (cat?.color || "#6366f1") + "22", color: cat?.color || "#6366f1" }}>
                        {cat && <Icon name={cat.icon} size={12} />}{cat?.label}
                      </span>
                    </div>
                    <div className="font-mono text-[13px] font-semibold text-amber-400 text-right">-{formatCFA(exp.amount)}</div>
                    <div className="flex justify-end gap-0.5">
                      <button onClick={() => handleEditExpense(exp)} className="text-slate-600 hover:text-emerald-400 transition-colors p-1" title="Modifier"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(exp.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1"><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              }
              const fp = item.data;
              return (
                <div className="expense-row grid grid-cols-[100px_1fr_160px_120px_70px] px-5 py-3.5 items-center border-b border-white/[0.03] bg-orange-500/[0.03]">
                  <div className="font-mono text-xs text-slate-400">
                    <div>{new Date(fp.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</div>
                    {fp.time && fp.time !== "00:00" && <div className="text-[10px] text-slate-500">{fp.time}</div>}
                  </div>
                  <div className="text-[13px]">{fp.label}{fp.notes && <span className="text-[10px] text-slate-500 ml-2">— {fp.notes}</span>}</div>
                  <div>
                    <span className="text-[11px] font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1 bg-orange-500/20 text-orange-400"><Landmark size={12} /> Charge fixe</span>
                  </div>
                  <div className="font-mono text-[13px] font-semibold text-orange-300 text-right">-{formatCFA(fp.amount)}</div>
                  <div className="flex justify-end">
                    <button onClick={async () => { await removeFixedPayment(fp.id); showToast("Paiement supprimé", "info"); }} className="text-slate-600 hover:text-red-400 transition-colors p-1"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            }}
          />
        ) : (
          allHistory.map((item) => {
            if (item.kind === "expense") {
              const exp = item.data;
              const cat = config.categories.find((c: Category) => c.id === exp.category);
              return (
                <div key={`e-${exp.id}`} className="expense-row grid grid-cols-[100px_1fr_160px_120px_70px] px-5 py-3.5 items-center border-b border-white/[0.03]">
                  <div className="font-mono text-xs text-slate-400">
                    <div>{new Date(exp.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</div>
                    {exp.time && exp.time !== "00:00" && <div className="text-[10px] text-slate-500">{exp.time}</div>}
                  </div>
                  <div className="text-[13px]">{exp.description}</div>
                  <div>
                    <span className="text-[11px] font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1"
                      style={{ background: (cat?.color || "#6366f1") + "22", color: cat?.color || "#6366f1" }}>
                      {cat && <Icon name={cat.icon} size={12} />}{cat?.label}
                    </span>
                  </div>
                  <div className="font-mono text-[13px] font-semibold text-amber-400 text-right">-{formatCFA(exp.amount)}</div>
                  <div className="flex justify-end gap-0.5">
                    <button onClick={() => handleEditExpense(exp)} className="text-slate-600 hover:text-emerald-400 transition-colors p-1" title="Modifier"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(exp.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            }
            const fp = item.data;
            return (
              <div key={`f-${fp.id}`} className="expense-row grid grid-cols-[100px_1fr_160px_120px_70px] px-5 py-3.5 items-center border-b border-white/[0.03] bg-orange-500/[0.03]">
                <div className="font-mono text-xs text-slate-400">
                  <div>{new Date(fp.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</div>
                  {fp.time && fp.time !== "00:00" && <div className="text-[10px] text-slate-500">{fp.time}</div>}
                </div>
                <div className="text-[13px]">{fp.label}{fp.notes && <span className="text-[10px] text-slate-500 ml-2">— {fp.notes}</span>}</div>
                <div>
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1 bg-orange-500/20 text-orange-400"><Landmark size={12} /> Charge fixe</span>
                </div>
                <div className="font-mono text-[13px] font-semibold text-orange-300 text-right">-{formatCFA(fp.amount)}</div>
                <div className="flex justify-end">
                  <button onClick={async () => { await removeFixedPayment(fp.id); showToast("Paiement supprimé", "info"); }} className="text-slate-600 hover:text-red-400 transition-colors p-1"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })
        )}
        </div>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden">
        {allHistory.length === 0 ? (
          <div className="glass-strong rounded-2xl py-12 text-center text-slate-500">
            <div className="mb-3 flex justify-center">
              <FileText size={36} className="text-slate-600" />
            </div>
            Aucune transaction pour {MONTHS_FULL[selectedMonth]}
          </div>
        ) : allHistory.length > VIRTUAL_LIST_THRESHOLD ? (
          <VirtualList
            items={allHistory}
            estimateSize={88}
            maxHeight="55vh"
            getItemKey={(item) => (item.kind === "expense" ? `e-${item.data.id}` : `f-${item.data.id}`)}
            renderItem={(item) => {
              if (item.kind === "fixed") {
                const fp = item.data;
                return (
                  <div className="mb-2">
                    <div className="glass rounded-xl p-3.5 border-l-2 border-orange-500/50">
                      <div className="flex justify-between items-start mb-1.5">
                        <div>
                          <div className="text-[13px] font-medium flex items-center gap-1.5">
                            <Icon name={fp.icon} size={14} className="text-orange-400" />
                            {fp.label}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {new Date(fp.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                            {fp.time && fp.time !== "00:00" && ` à ${fp.time}`}
                            {fp.notes && ` — ${fp.notes}`}
                          </div>
                        </div>
                        <div className="font-mono text-sm font-bold text-orange-300">-{formatCFA(fp.amount)}</div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 inline-flex items-center gap-1"><Landmark size={10} /> Charge fixe</span>
                        <button onClick={async () => { await removeFixedPayment(fp.id); showToast("Paiement supprimé", "info"); }} className="text-slate-600 hover:text-red-400 transition-colors p-1"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  </div>
                );
              }
              const exp = item.data;
              const cat = config.categories.find((c: Category) => c.id === exp.category);
              return (
                <div className="mb-2">
                  <div className="glass rounded-xl p-3.5">
                    <div className="flex justify-between items-start mb-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{exp.description}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                            style={{ background: (cat?.color || "#6366f1") + "22", color: cat?.color || "#6366f1" }}>
                            {cat && <Icon name={cat.icon} size={10} />}{cat?.label}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {new Date(exp.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                            {exp.time && exp.time !== "00:00" && ` ${exp.time}`}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <span className="font-mono text-sm font-bold text-amber-400">-{formatCFA(exp.amount)}</span>
                        <button onClick={() => handleEditExpense(exp)} className="text-slate-500 active:text-emerald-400 p-1.5" title="Modifier"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete(exp.id)} className="text-slate-500 active:text-red-400 p-1.5"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }}
          />
        ) : (
          <div className="space-y-2">
          {allHistory.map((item) => {
            if (item.kind === "fixed") {
              const fp = item.data;
              return (
                <div key={`f-${fp.id}`} className="glass rounded-xl p-3.5 border-l-2 border-orange-500/50">
                  <div className="flex justify-between items-start mb-1.5">
                    <div>
                      <div className="text-[13px] font-medium flex items-center gap-1.5">
                        <Icon name={fp.icon} size={14} className="text-orange-400" />
                        {fp.label}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(fp.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                        {fp.time && fp.time !== "00:00" && ` à ${fp.time}`}
                        {fp.notes && ` — ${fp.notes}`}
                      </div>
                    </div>
                    <div className="font-mono text-sm font-bold text-orange-300">-{formatCFA(fp.amount)}</div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 inline-flex items-center gap-1">
                      <Landmark size={10} /> Charge fixe
                    </span>
                    <button onClick={async () => { await removeFixedPayment(fp.id); showToast("Paiement supprimé", "info"); }}
                      className="text-slate-600 hover:text-red-400 transition-colors p-1">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            }
            const exp = item.data;
            const cat = config.categories.find((c: Category) => c.id === exp.category);
            return (
              <div key={`e-${exp.id}`} className="glass rounded-xl p-3.5">
                <div className="flex justify-between items-start mb-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{exp.description}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                        style={{ background: (cat?.color || "#6366f1") + "22", color: cat?.color || "#6366f1" }}
                      >
                        {cat && <Icon name={cat.icon} size={10} />}
                        {cat?.label}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {new Date(exp.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                        {exp.time && exp.time !== "00:00" && ` ${exp.time}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <span className="font-mono text-sm font-bold text-amber-400">
                      -{formatCFA(exp.amount)}
                    </span>
                    <button onClick={() => handleEditExpense(exp)} className="text-slate-500 active:text-emerald-400 p-1.5" title="Modifier"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(exp.id)} className="text-slate-500 active:text-red-400 p-1.5"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* ── Section dépenses planifiées ── */}
      {(pendingPlanned.length > 0 || executedPlanned.length > 0) && (
        <div ref={plannedSectionRef} className="mt-5 lg:mt-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <CalendarClock size={16} className="text-emerald-400" /> Dépenses planifiées
            </h3>
            <button onClick={() => setShowPlanModal(true)}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              <Plus size={14} /> Planifier
            </button>
          </div>
          {pendingPlanned.length > 0 && (
            <div className="space-y-2 mb-3">
              {pendingPlanned.map((p) => {
                const cat = config.categories.find((c: Category) => c.id === p.category);
                const due = getDueLabel(p.due_date);
                const isHighlighted = highlightedPlannedId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`glass rounded-xl p-3.5 border-l-2 transition-all ${
                      isHighlighted ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-[var(--bg-primary)] border-emerald-400" : "border-emerald-500/50"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{p.description}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {cat && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                              style={{ background: (cat.color || "#6366f1") + "22", color: cat.color || "#6366f1" }}>
                              <Icon name={cat.icon} size={10} /> {cat.label}
                            </span>
                          )}
                          <span className="text-[10px] flex items-center gap-1">
                            <Clock size={10} className={due.cls} />
                            <span className={due.cls}>{due.text}</span>
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(p.due_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="font-mono text-sm font-bold text-emerald-300 mr-1">
                          {formatCFA(p.amount)}
                        </span>
                        <button onClick={() => handleExecutePlanned(p.id)}
                          title="Valider maintenant"
                          className="text-slate-500 hover:text-emerald-400 active:text-emerald-400 p-1 transition-colors">
                          <CirclePlay size={15} />
                        </button>
                        <button onClick={() => handleEditPlanned(p)}
                          title="Modifier"
                          className="text-slate-500 hover:text-emerald-400 active:text-emerald-400 p-1 transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={async () => { await removePlannedExpense(p.id); showToast("Planification annulée", "info"); }}
                          title="Supprimer"
                          className="text-slate-600 hover:text-red-400 active:text-red-400 p-1 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {executedPlanned.length > 0 && (
            <details className="group">
              <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-400 flex items-center gap-1 mb-2">
                <CircleCheck size={12} className="text-emerald-500" /> {executedPlanned.length} exécutée{executedPlanned.length > 1 ? "s" : ""}
              </summary>
              <div className="space-y-1.5">
                {executedPlanned.slice(0, 5).map((p) => (
                  <div key={p.id} className="glass rounded-lg p-2.5 flex items-center gap-3 opacity-50">
                    <CircleCheck size={14} className="text-emerald-400 shrink-0" />
                    <span className="text-xs flex-1 truncate">{p.description}</span>
                    <span className="font-mono text-xs text-slate-500">{formatCFA(p.amount)}</span>
                    <span className="text-[10px] text-slate-600">
                      {new Date(p.due_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Bouton planifier si aucune planification */}
      {pendingPlanned.length === 0 && executedPlanned.length === 0 && (
        <div className="mt-5">
          <button onClick={() => setShowPlanModal(true)}
            className="w-full glass rounded-xl p-4 text-center hover:bg-white/[0.04] transition-colors group">
            <CalendarClock size={24} className="mx-auto mb-2 text-slate-600 group-hover:text-emerald-400 transition-colors" />
            <p className="text-xs text-slate-500 group-hover:text-slate-400">Planifier une dépense à venir</p>
          </button>
        </div>
      )}

      {/* ── Historique par période ── */}
      <HistoryByPeriod config={config} selectedYear={selectedYear} />

      {/* Modal — Planifier / Modifier une dépense */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
          onClick={closePlanModal}>
          <div className="glass-strong w-full sm:w-[480px] rounded-t-2xl sm:rounded-2xl p-6 lg:p-8 animate-slide-up min-h-[85dvh] sm:min-h-0 max-h-[95dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-bold flex items-center gap-2">
                {editingPlanned ? (
                  <><Pencil size={18} className="text-emerald-400" /> Modifier la dépense</>
                ) : (
                  <><CalendarClock size={18} className="text-emerald-400" /> Planifier une dépense</>
                )}
              </h2>
              <button onClick={closePlanModal} className="text-slate-400 p-1"><X size={20} /></button>
            </div>
            <div className="grid gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Date d&apos;échéance</label>
                <input type="date" className="input-field" value={planForm.due_date}
                  onChange={(e) => setPlanForm({ ...planForm, due_date: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Description</label>
                <input className="input-field" placeholder="Ex: Renouveler abonnement, Achat prévu..."
                  value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Catégorie</label>
                  <select className="input-field" value={planForm.category}
                    onChange={(e) => setPlanForm({ ...planForm, category: e.target.value })}>
                    {config.categories.map((c: Category) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Montant (FCFA)</label>
                  <input type="number" className="input-field font-mono" placeholder="0"
                    value={planForm.amount} onChange={(e) => setPlanForm({ ...planForm, amount: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Notes (optionnel)</label>
                <input className="input-field" placeholder="Détails..."
                  value={planForm.notes} onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={closePlanModal} className="flex-1 min-h-[44px] py-3 rounded-xl border border-white/10 text-slate-400 text-sm touch-manipulation">Annuler</button>
              <button onClick={handleSavePlan} className="btn-primary flex-1 min-h-[44px] py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 touch-manipulation">
                {editingPlanned ? <><Check size={16} /> Enregistrer</> : <><CalendarClock size={16} /> Planifier</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Nouvelle dépense */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
          onClick={closeExpenseModal}
        >
          <div
            className="glass-strong w-full sm:w-[480px] rounded-t-2xl sm:rounded-2xl p-6 lg:p-8 animate-slide-up min-h-[85dvh] sm:min-h-0 max-h-[95dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base lg:text-lg font-bold flex items-center gap-2">
                {editingExpense ? (
                  <><Pencil size={18} className="text-emerald-400" /> Modifier la dépense</>
                ) : (
                  <><Plus size={18} className="text-emerald-400" /> Nouvelle Dépense</>
                )}
              </h2>
              <button onClick={closeExpenseModal} className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Date</label>
                  <input type="date" className="input-field" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Heure</label>
                  <input type="time" className="input-field" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Description</label>
                <input className="input-field" placeholder="Ex: Courses marché..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Catégorie</label>
                  <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {config.categories.map((c: Category) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Montant (FCFA)</label>
                  <input type="number" className="input-field font-mono" placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Notes (optionnel)</label>
                <input className="input-field" placeholder="Notes..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={closeExpenseModal} className="flex-1 min-h-[44px] py-3 rounded-xl border border-white/10 text-slate-400 text-sm touch-manipulation">
                Annuler
              </button>
              <button onClick={handleSubmit} className="btn-primary flex-1 min-h-[44px] py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 touch-manipulation">
                <Check size={16} /> {editingExpense ? "Enregistrer" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type PeriodType = "day" | "month" | "quarter" | "semester" | "year";

const PERIOD_LABELS: Record<PeriodType, string> = {
  day: "Jour",
  month: "Mois",
  quarter: "Trimestre",
  semester: "Semestre",
  year: "Année",
};

const QUARTER_LABELS = ["T1 (Jan–Mar)", "T2 (Avr–Jun)", "T3 (Jul–Sep)", "T4 (Oct–Déc)"];
const SEMESTER_LABELS = ["S1 (Jan–Jun)", "S2 (Jul–Déc)"];

function getDateRange(period: PeriodType, selectedYear: number, periodIndex: number, dayDate: string): { start: string; end: string; label: string } {
  const y = selectedYear;
  switch (period) {
    case "day":
      return { start: dayDate, end: dayDate, label: new Date(dayDate).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }) };
    case "month": {
      const m = periodIndex;
      const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      const end = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      return { start, end, label: `${MONTHS_FULL[m]} ${y}` };
    }
    case "quarter": {
      const startMonth = periodIndex * 3;
      const endMonth = startMonth + 2;
      const start = `${y}-${String(startMonth + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(y, endMonth + 1, 0).getDate();
      const end = `${y}-${String(endMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      return { start, end, label: `${QUARTER_LABELS[periodIndex]} ${y}` };
    }
    case "semester": {
      const startMonth = periodIndex * 6;
      const endMonth = startMonth + 5;
      const start = `${y}-${String(startMonth + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(y, endMonth + 1, 0).getDate();
      const end = `${y}-${String(endMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      return { start, end, label: `${SEMESTER_LABELS[periodIndex]} ${y}` };
    }
    case "year":
      return { start: `${y}-01-01`, end: `${y}-12-31`, label: `Année ${y}` };
  }
}

function HistoryByPeriod({ config, selectedYear }: { config: BudgetConfig; selectedYear: number }) {
  const [period, setPeriod] = useState<PeriodType>("month");
  const [periodIndex, setPeriodIndex] = useState(new Date().getMonth());
  const [dayDate, setDayDate] = useState(new Date().toISOString().split("T")[0]);
  const [historyData, setHistoryData] = useState<Expense[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const range = useMemo(
    () => getDateRange(period, selectedYear, periodIndex, dayDate),
    [period, selectedYear, periodIndex, dayDate]
  );

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const r = await fetch(`/api/expenses?start=${range.start}&end=${range.end}`);
      if (r.ok) setHistoryData(await r.json());
    } catch { /* ignore */ }
    setLoadingHistory(false);
  }, [range.start, range.end]);

  useEffect(() => {
    if (expanded) fetchHistory();
  }, [expanded, fetchHistory]);

  const totalHistory = useMemo(() => historyData.reduce((s, e) => s + e.amount, 0), [historyData]);
  const avgDaily = useMemo(() => {
    if (historyData.length === 0) return 0;
    const days = new Set(historyData.map((e) => e.date)).size;
    return days > 0 ? Math.round(totalHistory / days) : 0;
  }, [historyData, totalHistory]);

  const groupedByDate = useMemo(() => {
    const map: Record<string, Expense[]> = {};
    historyData.forEach((e) => { (map[e.date] ||= []).push(e); });
    Object.values(map).forEach((arr) => arr.sort((a, b) => (b.time || "00:00").localeCompare(a.time || "00:00")));
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [historyData]);

  const handlePeriodChange = (p: PeriodType) => {
    setPeriod(p);
    if (p === "month") setPeriodIndex(new Date().getMonth());
    else if (p === "quarter") setPeriodIndex(Math.floor(new Date().getMonth() / 3));
    else if (p === "semester") setPeriodIndex(Math.floor(new Date().getMonth() / 6));
    else if (p === "day") setDayDate(new Date().toISOString().split("T")[0]);
  };

  const maxIndex = period === "month" ? 11 : period === "quarter" ? 3 : period === "semester" ? 1 : 0;
  const canPrev = period === "day" || periodIndex > 0;
  const canNext = period === "day" || periodIndex < maxIndex;

  const navigatePrev = () => {
    if (period === "day") {
      const d = new Date(dayDate);
      d.setDate(d.getDate() - 1);
      setDayDate(d.toISOString().split("T")[0]);
    } else if (periodIndex > 0) setPeriodIndex(periodIndex - 1);
  };
  const navigateNext = () => {
    if (period === "day") {
      const d = new Date(dayDate);
      d.setDate(d.getDate() + 1);
      setDayDate(d.toISOString().split("T")[0]);
    } else if (periodIndex < maxIndex) setPeriodIndex(periodIndex + 1);
  };

  return (
    <div className="mt-5 lg:mt-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full glass-strong rounded-xl p-4 flex items-center justify-between hover:bg-white/[0.04] transition-colors"
      >
        <span className="text-sm font-bold flex items-center gap-2">
          <History size={16} className="text-emerald-400" /> Historique des dépenses
        </span>
        <ChevronRight size={16} className={`text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 animate-slide-up">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(PERIOD_LABELS) as PeriodType[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                  period === p ? "bg-emerald-500/30 text-emerald-300 ring-1 ring-emerald-500/50" : "bg-white/5 text-slate-400 hover:bg-white/10"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between glass rounded-xl p-3">
            <button onClick={navigatePrev} disabled={!canPrev}
              className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 disabled:opacity-30 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <div className="text-center">
              {period === "day" ? (
                <input type="date" className="input-field text-xs text-center" value={dayDate}
                  onChange={(e) => setDayDate(e.target.value)} />
              ) : (
                <span className="text-xs font-semibold text-slate-300">{range.label}</span>
              )}
            </div>
            <button onClick={navigateNext} disabled={!canNext}
              className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 disabled:opacity-30 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="glass rounded-xl p-3 text-center">
              <div className="text-[10px] text-slate-500">Total période</div>
              <div className="font-mono text-sm font-bold text-red-400 mt-0.5">{formatCFA(totalHistory)}</div>
            </div>
            <div className="glass rounded-xl p-3 text-center">
              <div className="text-[10px] text-slate-500">Moyenne / jour</div>
              <div className="font-mono text-sm font-bold text-amber-400 mt-0.5">{formatCFA(avgDaily)}</div>
            </div>
          </div>

          {loadingHistory ? (
            <div className="text-center py-6 text-slate-500 text-xs">Chargement...</div>
          ) : historyData.length === 0 ? (
            <div className="glass rounded-xl py-8 text-center text-slate-500">
              <Calendar size={28} className="mx-auto mb-2 text-slate-600" />
              <p className="text-xs">Aucune dépense sur cette période</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedByDate.map(([date, items]) => {
                const dayTotal = items.reduce((s, e) => s + e.amount, 0);
                return (
                  <div key={date} className="glass-strong rounded-xl overflow-hidden">
                    <div className="flex justify-between items-center px-3.5 py-2 bg-white/[0.03] border-b border-white/5">
                      <span className="text-[11px] font-semibold text-slate-400">
                        {new Date(date).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short", year: period === "year" ? "numeric" : undefined })}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-red-400">-{formatCFA(dayTotal)}</span>
                    </div>
                    {items.map((e) => {
                      const cat = config.categories.find((c: Category) => c.id === e.category);
                      return (
                        <div key={e.id} className="flex items-center gap-3 px-3.5 py-2 border-b border-white/[0.02] last:border-0">
                          {cat && (
                            <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                              style={{ background: (cat.color || "#6366f1") + "22" }}>
                              <Icon name={cat.icon} size={12} style={{ color: cat.color }} />
                            </span>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs truncate">{e.description}</div>
                            {e.time && e.time !== "00:00" && (
                              <div className="text-[9px] text-slate-500">{e.time}</div>
                            )}
                          </div>
                          <span className="font-mono text-xs font-semibold text-red-300 shrink-0">-{formatCFA(e.amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-center text-[10px] text-slate-500 pt-1">
            {historyData.length} transaction{historyData.length > 1 ? "s" : ""} · {groupedByDate.length} jour{groupedByDate.length > 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
