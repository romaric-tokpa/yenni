"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatCFA, MONTHS_FULL, EXPENSES_PAGE_SIZE, getSelectableYears, suggestedTransactionFeePercentFromAccount, accountHasActiveOutgoingLock } from "@/lib/constants";
import { BudgetConfig, Expense, FixedChargePayment, Category, PlannedExpense, AccountWithBalance, Income, AccountTransfer } from "@/lib/types";
import { Plus, Trash2, X, FileText, Check, Landmark, CalendarClock, Clock, CircleCheck, Pencil, CirclePlay, History, Calendar, ChevronLeft, ChevronRight, FileSpreadsheet, List, CalendarDays, TrendingUp, ArrowRightLeft, Filter } from "lucide-react";
import { exportTransactionsCSV } from "@/lib/exportUtils";
import { getIncomeSourceLabel, isIncomeCountedInMonthlyBudget } from "@/lib/incomeSources";
import { getModalHref } from "@/lib/modal";
import Icon from "./ui/Icon";
import AccountSelect from "./AccountSelect";

type HistoryItem =
  | { kind: "expense"; data: Expense }
  | { kind: "fixed"; data: FixedChargePayment }
  | { kind: "income"; data: Income }
  | { kind: "transfer"; data: AccountTransfer };

type TxTypeFilter = "all" | HistoryItem["kind"];

const TX_FILTER_OPTIONS: { key: TxTypeFilter; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "expense", label: "Dépenses variables" },
  { key: "fixed", label: "Charges fixes" },
  { key: "income", label: "Revenus" },
  { key: "transfer", label: "Transferts" },
];

/** Horodatage local pour tri fiable (plus récent en premier). */
function historyItemTimestamp(item: HistoryItem): number {
  const d = item.data.date;
  const rawT = item.data.time || "00:00";
  const parts = rawT.split(":");
  const h = parseInt(parts[0] ?? "0", 10) || 0;
  const m = parseInt(parts[1] ?? "0", 10) || 0;
  const [y, mo, day] = d.split("-").map((x) => parseInt(x, 10) || 0);
  return new Date(y, mo - 1, day, h, m, 0, 0).getTime();
}

function compareHistoryNewestFirst(a: HistoryItem, b: HistoryItem): number {
  const tb = historyItemTimestamp(b);
  const ta = historyItemTimestamp(a);
  if (tb !== ta) return tb - ta;
  return b.data.id - a.data.id;
}

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
  accountsWithBalance: AccountWithBalance[];
  incomes: Income[];
  removeIncome: (id: number) => Promise<void>;
  refreshAll: () => Promise<void>;
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
    accountsWithBalance,
    incomes,
    removeIncome,
    refreshAll,
  } = budget;

  const activeAccounts = useMemo(
    () => accountsWithBalance.filter((a) => !a.is_archived),
    [accountsWithBalance]
  );
  const debitAccounts = useMemo(
    () => activeAccounts.filter((a) => !accountHasActiveOutgoingLock(a.kind, a.vault_unlocks_on)),
    [activeAccounts]
  );
  const firstDebitAccountId = debitAccounts[0]?.id;

  const [transfers, setTransfers] = useState<AccountTransfer[]>([]);

  const refetchTransfers = useCallback(async () => {
    try {
      const r = await fetch(`/api/account-transfers?month=${selectedMonth}&year=${selectedYear}`);
      if (r.ok) setTransfers(await r.json());
    } catch {
      /* ignore */
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    refetchTransfers();
  }, [refetchTransfers]);

  const getCategoryDisplay = useCallback((categoryId: string) => {
    const cat = config.categories.find((c: Category) => c.id === categoryId);
    if (cat) return { label: cat.label, icon: cat.icon, color: cat.color };
    const wishCat = config.wishCategories?.find((c) => c.id === categoryId);
    if (wishCat) return { label: wishCat.label, icon: wishCat.icon, color: wishCat.color };
    return { label: categoryId, icon: "wrench", color: "#6366f1" };
  }, [config.categories, config.wishCategories]);

  const allHistory = useMemo(() => {
    const items: HistoryItem[] = [
      ...expenses.map((e) => ({ kind: "expense" as const, data: e })),
      ...fixedPayments.map((p) => ({ kind: "fixed" as const, data: p })),
      ...incomes.map((i) => ({ kind: "income" as const, data: i })),
      ...transfers.map((t) => ({ kind: "transfer" as const, data: t })),
    ];
    items.sort(compareHistoryNewestFirst);
    return items;
  }, [expenses, fixedPayments, incomes, transfers]);

  const totalAllSpent = totalMonthSpent + totalFixed;
  const totalManualIncomes = useMemo(
    () => incomes.filter((i) => isIncomeCountedInMonthlyBudget(i.source)).reduce((s, i) => s + i.amount, 0),
    [incomes],
  );
  /** Volume transféré sur le mois (montants + frais), pour la pastille synthèse. */
  const totalTransfersVolume = useMemo(
    () => transfers.reduce((s, t) => s + t.amount + (t.fee ?? 0), 0),
    [transfers],
  );
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "byDay">("list");
  const [currentPage, setCurrentPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<TxTypeFilter>("all");

  const typeCounts = useMemo(() => {
    const c = { all: allHistory.length, expense: 0, fixed: 0, income: 0, transfer: 0 };
    for (const item of allHistory) {
      c[item.kind] += 1;
    }
    return c;
  }, [allHistory]);

  const filteredHistory = useMemo(() => {
    if (typeFilter === "all") return allHistory;
    return allHistory.filter((item) => item.kind === typeFilter);
  }, [allHistory, typeFilter]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    for (const item of filteredHistory) {
      const date = item.data.date;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(item);
    }
    return Array.from(map.entries())
      .map(([dateStr, items]) => [dateStr, [...items].sort(compareHistoryNewestFirst)] as const)
      .sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredHistory]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / EXPENSES_PAGE_SIZE));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * EXPENSES_PAGE_SIZE;
    return filteredHistory.slice(start, start + EXPENSES_PAGE_SIZE);
  }, [filteredHistory, currentPage]);

  const listRangeStart = filteredHistory.length === 0 ? 0 : (currentPage - 1) * EXPENSES_PAGE_SIZE + 1;
  const listRangeEnd = Math.min(currentPage * EXPENSES_PAGE_SIZE, filteredHistory.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth, selectedYear, viewMode, typeFilter]);

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
        router.replace("/transactions", { scroll: false });
        const t = setTimeout(() => setHighlightedPlannedId(null), 3000);
        return () => clearTimeout(t);
      }
    }
  }, [searchParams, plannedExpenses, router]);

  const planDefault = useMemo(
    () => ({
      due_date: "",
      description: "",
      category: config.categories[0]?.id || "food",
      amount: "",
      notes: "",
      account_id: 0 as number,
    }),
    [config.categories]
  );
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
    transaction_fee: "",
    account_id: "" as string,
  });

  const expenseAccountOptions = useMemo(() => {
    const base = debitAccounts;
    if (editingExpense?.account_id) {
      const cur = activeAccounts.find((a) => a.id === editingExpense.account_id);
      if (cur && !base.some((b) => b.id === cur.id)) return [...base, cur];
    }
    return base;
  }, [debitAccounts, activeAccounts, editingExpense]);

  const expenseModalAccountId = form.account_id ? Number(form.account_id) : firstDebitAccountId;
  const expenseModalSelectedAccount =
    expenseAccountOptions.find((a) => a.id === expenseModalAccountId) ?? expenseAccountOptions[0];
  const expenseModalFeePct = suggestedTransactionFeePercentFromAccount(
    expenseModalSelectedAccount?.kind,
    expenseModalSelectedAccount?.subtype,
  );

  const handleSubmit = async () => {
    if (!form.description || !form.amount || Number(form.amount) <= 0) {
      showToast("Remplis tous les champs", "error");
      return;
    }
    if (!editingExpense && !firstDebitAccountId) {
      showToast("Aucun compte débitable (tous coffres verrouillés ?).", "error");
      return;
    }
    if (editingExpense) {
      const fee = form.transaction_fee ? Number(form.transaction_fee) : 0;
      const accId = form.account_id ? Number(form.account_id) : firstDebitAccountId;
      const ok = await updateExpense(editingExpense.id, {
        date: form.date,
        time: form.time || "00:00",
        description: form.description,
        category: form.category,
        amount: Number(form.amount),
        notes: form.notes,
        payment_method: "cash",
        transaction_fee: fee,
        account_id: accId,
      });
      if (ok) {
        showToast("Dépense modifiée !");
        closeExpenseModal();
      }
    } else {
      const fee = form.transaction_fee ? Number(form.transaction_fee) : 0;
      const accId = form.account_id ? Number(form.account_id) : firstDebitAccountId;
      const ok = await addExpense({
        ...form,
        amount: Number(form.amount),
        time: form.time || "00:00",
        payment_method: "cash",
        transaction_fee: fee,
        account_id: accId,
      });
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
      transaction_fee: "",
      account_id: firstDebitAccountId ? String(firstDebitAccountId) : "",
    });
    setEditingExpense(null);
    setShowModal(false);
  };

  const getAccountName = (id: number | null | undefined) =>
    accountsWithBalance.find((a) => a.id === id)?.name ?? (id ? `Compte #${id}` : "—");
  const getExpenseTotal = (exp: Expense) => exp.amount + (exp.transaction_fee ?? 0);
  const getExpenseTotalLabel = (exp: Expense) => {
    const total = getExpenseTotal(exp);
    const fee = exp.transaction_fee ?? 0;
    if (fee > 0) return `${formatCFA(total)} (dont ${formatCFA(fee)} frais)`;
    return formatCFA(total);
  };
  const getOutflowAmount = (item: HistoryItem) => {
    if (item.kind === "expense") return getExpenseTotal(item.data);
    if (item.kind === "fixed") return item.data.amount;
    return 0;
  };
  const getInflowAmount = (item: HistoryItem) => (item.kind === "income" ? item.data.amount : 0);

  const handleDeleteIncome = async (id: number) => {
    await removeIncome(id);
    showToast("Revenu supprimé", "info");
  };

  const handleDeleteTransfer = async (id: number) => {
    const r = await fetch(`/api/account-transfers?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      showToast("Transfert supprimé", "info");
      await refetchTransfers();
      await refreshAll();
    } else {
      showToast("Impossible de supprimer le transfert", "error");
    }
  };

  const handleEditExpense = (exp: Expense) => {
    setForm({
      date: exp.date,
      time: exp.time || "00:00",
      description: exp.description,
      category: exp.category,
      amount: String(exp.amount),
      notes: exp.notes || "",
      transaction_fee: exp.transaction_fee ? String(exp.transaction_fee) : "",
      account_id: exp.account_id ? String(exp.account_id) : firstDebitAccountId ? String(firstDebitAccountId) : "",
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

  const openNewPlanModal = useCallback(() => {
    setPlanForm({ ...planDefault, account_id: firstDebitAccountId ?? 0 });
    setEditingPlanned(null);
    setShowPlanModal(true);
  }, [planDefault, firstDebitAccountId]);

  const handleEditPlanned = (p: PlannedExpense) => {
    setPlanForm({
      due_date: p.due_date,
      description: p.description,
      category: p.category,
      amount: String(p.amount),
      notes: p.notes,
      account_id:
        p.account_id != null && Number(p.account_id) > 0 ? Number(p.account_id) : firstDebitAccountId ?? 0,
    });
    setEditingPlanned(p);
    setShowPlanModal(true);
  };

  const handleSavePlan = async () => {
    if (!planForm.due_date || !planForm.description || !planForm.amount || Number(planForm.amount) <= 0) {
      showToast("Remplis tous les champs", "error");
      return;
    }
    const acc =
      planForm.account_id > 0 ? planForm.account_id : firstDebitAccountId ?? 0;
    if (!acc) {
      showToast("Choisis un compte de paiement", "error");
      return;
    }
    if (editingPlanned) {
      await updatePlannedExpense(editingPlanned.id, {
        due_date: planForm.due_date,
        description: planForm.description,
        category: planForm.category,
        amount: Number(planForm.amount),
        notes: planForm.notes,
        account_id: acc,
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
        account_id: acc,
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
    setPlanForm({ ...planDefault, account_id: firstDebitAccountId ?? 0 });
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-neutral-500 text-xs lg:text-sm mt-1">
            {allHistory.length} mouvement{allHistory.length !== 1 ? "s" : ""} enregistré{allHistory.length !== 1 ? "s" : ""}
            {typeFilter !== "all" && (
              <span className="text-emerald-400/90">
                {" "}
                · {filteredHistory.length} après filtre
              </span>
            )}{" "}
            — {MONTHS_FULL[selectedMonth]} {selectedYear}
            <span className="text-neutral-600"> · Dépenses, charges, revenus, transferts</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input-field w-32 text-sm py-2"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
          >
            {MONTHS_FULL.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <select
            className="input-field w-24 text-sm py-2"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {getSelectableYears().map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={() =>
              exportTransactionsCSV(
                expenses,
                fixedPayments,
                incomes,
                transfers,
                selectedMonth,
                selectedYear,
                config.categories,
                getAccountName
              )
            }
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-neutral-400 hover:text-white hover:border-white/20 text-xs font-medium transition-colors"
            title="Exporter toutes les transactions du mois (CSV)"
          >
            <FileSpreadsheet size={14} />
            CSV
          </button>
          <button
            onClick={() => router.push(getModalHref({ type: "new-expense", returnTo: "/transactions" }))}
            className="btn-primary px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 shrink-0"
          >
            <Plus size={18} strokeWidth={2.5} />
            Nouvelle dépense
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Dépenses variables", value: formatCFA(totalMonthSpent), color: "text-red-400" },
            { label: "Charges fixes", value: formatCFA(totalFixed), color: "text-red-500" },
            { label: "Total sorties", value: formatCFA(totalAllSpent), color: "text-red-500" },
            { label: "Revenus saisis", value: formatCFA(totalManualIncomes), color: "text-emerald-400" },
            { label: "Transferts (vol.)", value: formatCFA(totalTransfersVolume), color: "text-orange-400" },
            {
              label: "Reste budget var.",
              value: formatCFA(totalBudgetVar - totalMonthSpent),
              color: totalBudgetVar - totalMonthSpent >= 0 ? "text-emerald-400" : "text-red-400",
            },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-[10px] lg:text-xs text-neutral-500">{s.label}</div>
              <div className={`font-mono text-sm lg:text-lg font-bold mt-0.5 ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filtre par type + vue + pagination */}
      {allHistory.length > 0 && (
        <div className="space-y-3 mb-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              <Filter size={14} className="text-neutral-400" />
              Type de transaction
            </div>
            <div className="flex flex-wrap gap-2">
              {TX_FILTER_OPTIONS.map(({ key, label }) => {
                const count = typeCounts[key === "all" ? "all" : key];
                const active = typeFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTypeFilter(key)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      active
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                        : "border-white/10 bg-white/[0.02] text-neutral-400 hover:border-white/20 hover:text-neutral-200"
                    }`}
                  >
                    {label}
                    <span className="ml-1.5 font-mono text-[10px] opacity-80">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex rounded-lg border border-white/10 p-0.5 bg-white/[0.02] w-fit">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === "list" ? "bg-white/10 text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                <List size={16} /> Liste
              </button>
              <button
                type="button"
                onClick={() => setViewMode("byDay")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === "byDay" ? "bg-white/10 text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                <CalendarDays size={16} /> Par jour
              </button>
            </div>

            {viewMode === "list" && filteredHistory.length > 0 && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <span className="text-xs text-neutral-500">
                  <span className="text-neutral-400">{listRangeStart}–{listRangeEnd}</span> sur {filteredHistory.length}
                  {totalPages > 1 && (
                    <span className="text-neutral-600">
                      {" "}
                      · page {currentPage}/{totalPages}
                    </span>
                  )}
                  <span className="text-neutral-600"> · {EXPENSES_PAGE_SIZE} par page</span>
                </span>
                {totalPages > 1 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                    >
                      <ChevronLeft size={16} />
                      Précédent
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                    >
                      Suivant
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border border-white/5 bg-white/[0.02] overflow-x-auto">
        <div className="min-w-[580px]">
        <div className="grid grid-cols-[100px_1fr_160px_120px_70px] px-5 py-3 bg-white/[0.03] border-b border-white/5 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
          <div>Date</div>
          <div>Description</div>
          <div>Type</div>
          <div className="text-right">Montant</div>
          <div />
        </div>
        {allHistory.length === 0 ? (
          <div className="py-16 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-amber-500/10 mb-4">
              <FileText size={28} className="text-amber-400/80" />
            </div>
            <p className="text-neutral-500 text-sm">Aucune transaction pour {MONTHS_FULL[selectedMonth]} {selectedYear}</p>
            <button
              onClick={() => router.push(getModalHref({ type: "new-expense", returnTo: "/transactions" }))}
              className="mt-4 btn-primary px-5 py-2.5 rounded-lg text-sm font-medium inline-flex items-center gap-2"
            >
              <Plus size={16} />
              Ajouter une dépense
            </button>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="py-16 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-white/5 mb-4">
              <Filter size={28} className="text-neutral-500" />
            </div>
            <p className="text-neutral-400 text-sm font-medium">Aucun résultat pour ce type</p>
            <p className="text-neutral-500 text-xs mt-1">Essaie « Tout » ou un autre filtre.</p>
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-sm text-neutral-300 hover:bg-white/[0.05] transition-colors"
            >
              Afficher tout
            </button>
          </div>
        ) : viewMode === "byDay" ? (
          groupedByDay.map(([dateStr, items]) => {
            const dayOut = items.reduce((s, i) => s + getOutflowAmount(i), 0);
            const dayIn = items.reduce((s, i) => s + getInflowAmount(i), 0);
            const dayXfer = items
              .filter((i) => i.kind === "transfer")
              .reduce((s, i) => s + i.data.amount + (i.data.fee ?? 0), 0);
            const nXfer = items.filter((i) => i.kind === "transfer").length;
            const dateLabel = new Date(dateStr + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
            return (
              <div key={dateStr} className="border-b border-white/5 last:border-b-0">
                <div className="px-5 py-2.5 bg-white/[0.02] flex flex-wrap justify-between items-center gap-2">
                  <span className="text-sm font-semibold text-slate-300 capitalize">{dateLabel}</span>
                  <div className="text-right text-xs leading-tight">
                    {dayOut > 0 && (
                      <span className="font-mono font-semibold text-red-400">−{formatCFA(dayOut)} sorties</span>
                    )}
                    {dayOut > 0 && dayIn > 0 && <span className="text-neutral-600 mx-2">·</span>}
                    {dayIn > 0 && (
                      <span className="font-mono font-semibold text-emerald-400">+{formatCFA(dayIn)} entrées</span>
                    )}
                    {dayXfer > 0 && (
                      <div className="text-[10px] text-orange-400 font-medium mt-0.5 font-mono">
                        ↔ {formatCFA(dayXfer)} ({nXfer} transfert{nXfer > 1 ? "s" : ""})
                      </div>
                    )}
                  </div>
                </div>
                {items.map((item) => {
                  if (item.kind === "expense") {
                    const exp = item.data;
                    const cat = getCategoryDisplay(exp.category);
                    return (
                      <div key={`e-${exp.id}`} className="expense-row grid grid-cols-[100px_1fr_160px_120px_70px] px-5 py-3.5 items-center border-b border-white/[0.02] pl-8">
                        <div className="font-mono text-xs text-slate-500">
                          {exp.time && exp.time !== "00:00" ? exp.time : "—"}
                        </div>
                        <div className="text-[13px]">{exp.description}</div>
                        <div className="flex flex-col gap-0.5">
                          <span
                            className="text-[11px] font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1 w-fit"
                            style={{ background: cat.color + "22", color: cat.color }}
                          >
                            <Icon name={cat.icon} size={12} />
                            {cat.label}
                          </span>
                          <span className="text-[9px] text-slate-500">{getAccountName(exp.account_id)}</span>
                        </div>
                        <div className="font-mono text-[13px] font-semibold text-red-400 text-right">-{getExpenseTotalLabel(exp)}</div>
                        <div className="flex justify-end gap-0.5">
                          <button onClick={() => handleEditExpense(exp)} className="text-slate-600 hover:text-emerald-400 transition-colors p-1" title="Modifier">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(exp.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  }
                  if (item.kind === "fixed") {
                    const fp = item.data;
                    return (
                      <div key={`f-${fp.id}`} className="expense-row grid grid-cols-[100px_1fr_160px_120px_70px] px-5 py-3.5 items-center border-b border-white/[0.02] pl-8 bg-orange-500/[0.03]">
                        <div className="font-mono text-xs text-slate-500">{fp.time && fp.time !== "00:00" ? fp.time : "—"}</div>
                        <div className="text-[13px]">
                          {fp.label}
                          {fp.notes && <span className="text-[10px] text-slate-500 ml-2">— {fp.notes}</span>}
                        </div>
                        <div>
                          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1 bg-orange-500/20 text-orange-400">
                            <Landmark size={12} /> Charge fixe
                          </span>
                        </div>
                        <div className="font-mono text-[13px] font-semibold text-red-400 text-right">-{formatCFA(fp.amount)}</div>
                        <div className="flex justify-end">
                          <button
                            onClick={async () => {
                              await removeFixedPayment(fp.id);
                              showToast("Paiement supprimé", "info");
                            }}
                            className="text-slate-600 hover:text-red-400 transition-colors p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  }
                  if (item.kind === "income") {
                    const inc = item.data;
                    return (
                      <div key={`i-${inc.id}`} className="expense-row grid grid-cols-[100px_1fr_160px_120px_70px] px-5 py-3.5 items-center border-b border-white/[0.02] pl-8 bg-emerald-500/[0.04]">
                        <div className="font-mono text-xs text-slate-500">{inc.time && inc.time !== "00:00" ? inc.time : "—"}</div>
                        <div className="text-[13px]">{inc.description}</div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1 w-fit bg-emerald-500/20 text-emerald-400">
                            <TrendingUp size={12} /> Revenu · {getIncomeSourceLabel(inc.source)}
                          </span>
                          <span className="text-[9px] text-slate-500">{getAccountName(inc.account_id)}</span>
                        </div>
                        <div className="font-mono text-[13px] font-semibold text-emerald-400 text-right">+{formatCFA(inc.amount)}</div>
                        <div className="flex justify-end">
                          <button onClick={() => handleDeleteIncome(inc.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  }
                  const xfer = item.data;
                  const fee = xfer.fee ?? 0;
                  return (
                    <div key={`t-${xfer.id}`} className="expense-row grid grid-cols-[100px_1fr_160px_120px_70px] px-5 py-3.5 items-center border-b border-white/[0.02] pl-8 bg-slate-500/[0.06]">
                      <div className="font-mono text-xs text-slate-500">{xfer.time && xfer.time !== "00:00" ? xfer.time : "—"}</div>
                      <div className="text-[13px]">{xfer.notes?.trim() ? xfer.notes : "Transfert entre comptes"}</div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1 w-fit bg-orange-500/15 text-orange-300">
                          <ArrowRightLeft size={12} /> Transfert
                        </span>
                        <span className="text-[9px] text-slate-500">
                          {getAccountName(xfer.from_account_id)} → {getAccountName(xfer.to_account_id)}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-[13px] font-semibold text-orange-400">↔ {formatCFA(xfer.amount)}</div>
                        {fee > 0 && <div className="text-[10px] text-slate-500">frais {formatCFA(fee)}</div>}
                      </div>
                      <div className="flex justify-end">
                        <button onClick={() => handleDeleteTransfer(xfer.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        ) : (
          paginatedItems.map((item) => {
            if (item.kind === "expense") {
              const exp = item.data;
              const cat = getCategoryDisplay(exp.category);
              return (
                <div key={`e-${exp.id}`} className="expense-row grid grid-cols-[100px_1fr_160px_120px_70px] px-5 py-3.5 items-center border-b border-white/[0.03]">
                  <div className="font-mono text-xs text-slate-400">
                    <div>{new Date(exp.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</div>
                    {exp.time && exp.time !== "00:00" && <div className="text-[10px] text-slate-500">{exp.time}</div>}
                  </div>
                  <div className="text-[13px]">{exp.description}</div>
                  <div className="flex flex-col gap-0.5">
                    <span
                      className="text-[11px] font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1 w-fit"
                      style={{ background: cat.color + "22", color: cat.color }}
                    >
                      <Icon name={cat.icon} size={12} />
                      {cat.label}
                    </span>
                    <span className="text-[9px] text-slate-500">{getAccountName(exp.account_id)}</span>
                  </div>
                  <div className="font-mono text-[13px] font-semibold text-red-400 text-right">-{getExpenseTotalLabel(exp)}</div>
                  <div className="flex justify-end gap-0.5">
                    <button onClick={() => handleEditExpense(exp)} className="text-slate-600 hover:text-emerald-400 transition-colors p-1" title="Modifier">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(exp.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            }
            if (item.kind === "fixed") {
              const fp = item.data;
              return (
                <div key={`f-${fp.id}`} className="expense-row grid grid-cols-[100px_1fr_160px_120px_70px] px-5 py-3.5 items-center border-b border-white/[0.03] bg-orange-500/[0.03]">
                  <div className="font-mono text-xs text-slate-400">
                    <div>{new Date(fp.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</div>
                    {fp.time && fp.time !== "00:00" && <div className="text-[10px] text-slate-500">{fp.time}</div>}
                  </div>
                  <div className="text-[13px]">
                    {fp.label}
                    {fp.notes && <span className="text-[10px] text-slate-500 ml-2">— {fp.notes}</span>}
                  </div>
                  <div>
                    <span className="text-[11px] font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1 bg-orange-500/20 text-orange-400">
                      <Landmark size={12} /> Charge fixe
                    </span>
                  </div>
                  <div className="font-mono text-[13px] font-semibold text-red-400 text-right">-{formatCFA(fp.amount)}</div>
                  <div className="flex justify-end">
                    <button
                      onClick={async () => {
                        await removeFixedPayment(fp.id);
                        showToast("Paiement supprimé", "info");
                      }}
                      className="text-slate-600 hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            }
            if (item.kind === "income") {
              const inc = item.data;
              return (
                <div key={`i-${inc.id}`} className="expense-row grid grid-cols-[100px_1fr_160px_120px_70px] px-5 py-3.5 items-center border-b border-white/[0.03] bg-emerald-500/[0.04]">
                  <div className="font-mono text-xs text-slate-400">
                    <div>{new Date(inc.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</div>
                    {inc.time && inc.time !== "00:00" && <div className="text-[10px] text-slate-500">{inc.time}</div>}
                  </div>
                  <div className="text-[13px]">{inc.description}</div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1 w-fit bg-emerald-500/20 text-emerald-400">
                      <TrendingUp size={12} /> Revenu · {getIncomeSourceLabel(inc.source)}
                    </span>
                    <span className="text-[9px] text-slate-500">{getAccountName(inc.account_id)}</span>
                  </div>
                  <div className="font-mono text-[13px] font-semibold text-emerald-400 text-right">+{formatCFA(inc.amount)}</div>
                  <div className="flex justify-end">
                    <button onClick={() => handleDeleteIncome(inc.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            }
            const xfer = item.data;
            const fee = xfer.fee ?? 0;
            return (
              <div key={`t-${xfer.id}`} className="expense-row grid grid-cols-[100px_1fr_160px_120px_70px] px-5 py-3.5 items-center border-b border-white/[0.03] bg-slate-500/[0.06]">
                <div className="font-mono text-xs text-slate-400">
                  <div>{new Date(xfer.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</div>
                  {xfer.time && xfer.time !== "00:00" && <div className="text-[10px] text-slate-500">{xfer.time}</div>}
                </div>
                <div className="text-[13px]">{xfer.notes?.trim() ? xfer.notes : "Transfert entre comptes"}</div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1 w-fit bg-orange-500/15 text-orange-300">
                    <ArrowRightLeft size={12} /> Transfert
                  </span>
                  <span className="text-[9px] text-slate-500">
                    {getAccountName(xfer.from_account_id)} → {getAccountName(xfer.to_account_id)}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[13px] font-semibold text-orange-400">↔ {formatCFA(xfer.amount)}</div>
                  {fee > 0 && <div className="text-[10px] text-slate-500">frais {formatCFA(fee)}</div>}
                </div>
                <div className="flex justify-end">
                  <button onClick={() => handleDeleteTransfer(xfer.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1">
                    <Trash2 size={14} />
                  </button>
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
          <div className="rounded-xl border border-white/5 bg-white/[0.02] py-12 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-amber-500/10 mb-4">
              <FileText size={28} className="text-amber-400/80" />
            </div>
            <p className="text-neutral-500 text-sm">Aucune transaction pour {MONTHS_FULL[selectedMonth]}</p>
            <button
              onClick={() => router.push(getModalHref({ type: "new-expense", returnTo: "/transactions" }))}
              className="mt-4 btn-primary px-5 py-2.5 rounded-lg text-sm font-medium inline-flex items-center gap-2"
            >
              <Plus size={16} />
              Ajouter une dépense
            </button>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] py-12 text-center">
            <Filter size={28} className="mx-auto mb-3 text-neutral-500" />
            <p className="text-neutral-400 text-sm font-medium">Aucun résultat pour ce type</p>
            <button type="button" onClick={() => setTypeFilter("all")} className="mt-4 text-sm text-emerald-400 hover:underline">
              Afficher tout
            </button>
          </div>
        ) : viewMode === "byDay" ? (
          <div className="space-y-4">
            {groupedByDay.map(([dateStr, items]) => {
              const dayOut = items.reduce((s, i) => s + getOutflowAmount(i), 0);
              const dayIn = items.reduce((s, i) => s + getInflowAmount(i), 0);
              const dayXfer = items
                .filter((i) => i.kind === "transfer")
                .reduce((s, i) => s + i.data.amount + (i.data.fee ?? 0), 0);
              const nXfer = items.filter((i) => i.kind === "transfer").length;
              const dateLabel = new Date(dateStr + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
              return (
                <div key={dateStr} className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                  <div className="px-4 py-2.5 bg-white/[0.03] flex flex-col gap-1 border-b border-white/5 sm:flex-row sm:justify-between sm:items-center">
                    <span className="text-sm font-semibold text-slate-300 capitalize">{dateLabel}</span>
                    <div className="text-xs text-right">
                      {dayOut > 0 && <span className="font-mono font-semibold text-red-400">−{formatCFA(dayOut)} </span>}
                      {dayIn > 0 && <span className="font-mono font-semibold text-emerald-400">+{formatCFA(dayIn)}</span>}
                      {dayXfer > 0 && (
                        <div className="text-[10px] text-orange-400 font-mono font-medium">
                          ↔ {formatCFA(dayXfer)} ({nXfer} transfert{nXfer > 1 ? "s" : ""})
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-2 space-y-2">
                    {items.map((item) => {
                      if (item.kind === "fixed") {
                        const fp = item.data;
                        return (
                          <div key={`f-${fp.id}`} className="rounded-lg border border-white/5 p-3" style={{ borderLeft: "3px solid rgb(248 113 113 / 0.55)" }}>
                            <div className="flex justify-between items-start">
                              <div className="text-[13px] font-medium">{fp.label}</div>
                              <div className="font-mono text-sm font-bold text-red-400">-{formatCFA(fp.amount)}</div>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-[9px] text-slate-500">
                                {fp.time && fp.time !== "00:00" ? fp.time : ""}
                                {fp.notes && ` — ${fp.notes}`}
                              </span>
                              <button
                                onClick={async () => {
                                  await removeFixedPayment(fp.id);
                                  showToast("Paiement supprimé", "info");
                                }}
                                className="text-slate-600 hover:text-red-400 p-1"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      }
                      if (item.kind === "income") {
                        const inc = item.data;
                        return (
                          <div key={`i-${inc.id}`} className="rounded-lg border border-white/5 p-3" style={{ borderLeft: "3px solid rgb(52 211 153 / 0.7)" }}>
                            <div className="flex justify-between items-start">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium truncate">{inc.description}</div>
                                <div className="text-[10px] text-emerald-400/90 mt-1">Revenu · {getIncomeSourceLabel(inc.source)}</div>
                                <div className="text-[9px] text-slate-500 mt-0.5">{getAccountName(inc.account_id)}</div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                <span className="font-mono text-sm font-bold text-emerald-400">+{formatCFA(inc.amount)}</span>
                                <button onClick={() => handleDeleteIncome(inc.id)} className="p-1.5 text-slate-500 active:text-red-400">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      if (item.kind === "transfer") {
                        const xfer = item.data;
                        const fee = xfer.fee ?? 0;
                        return (
                          <div key={`t-${xfer.id}`} className="rounded-lg border border-white/5 p-3" style={{ borderLeft: "3px solid rgb(251 146 60 / 0.55)" }}>
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium truncate">{xfer.notes?.trim() ? xfer.notes : "Transfert"}</div>
                                <div className="text-[9px] text-slate-500 mt-1">
                                  {getAccountName(xfer.from_account_id)} → {getAccountName(xfer.to_account_id)}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-mono text-sm font-bold text-orange-400">↔ {formatCFA(xfer.amount)}</div>
                                {fee > 0 && <div className="text-[10px] text-slate-500">frais {formatCFA(fee)}</div>}
                                <button onClick={() => handleDeleteTransfer(xfer.id)} className="p-1 text-slate-600 hover:text-red-400 mt-1">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      const exp = item.data;
                      const cat = getCategoryDisplay(exp.category);
                      return (
                        <div key={`e-${exp.id}`} className="rounded-lg border border-white/5 p-3" style={{ borderLeft: `3px solid ${cat.color}` }}>
                          <div className="flex justify-between items-start">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">{exp.description}</div>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: cat.color + "22", color: cat.color }}>
                                  <Icon name={cat.icon} size={10} />
                                  {cat.label}
                                </span>
                                <span className="text-[9px] text-slate-500">{getAccountName(exp.account_id)}</span>
                                {exp.time && exp.time !== "00:00" && <span className="text-[10px] text-slate-500">{exp.time}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              <span className="font-mono text-sm font-bold text-red-400">-{getExpenseTotalLabel(exp)}</span>
                              <button onClick={() => handleEditExpense(exp)} className="p-1.5 text-slate-500 active:text-emerald-400">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => handleDelete(exp.id)} className="p-1.5 text-slate-500 active:text-red-400">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {paginatedItems.map((item) => {
              if (item.kind === "fixed") {
                const fp = item.data;
                return (
                  <div key={`f-${fp.id}`} className="rounded-xl border border-white/5 bg-white/[0.03] p-3.5" style={{ borderLeft: "3px solid rgb(248 113 113 / 0.55)" }}>
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
                      <div className="font-mono text-sm font-bold text-red-400">-{formatCFA(fp.amount)}</div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 inline-flex items-center gap-1">
                        <Landmark size={10} /> Charge fixe
                      </span>
                      <button
                        onClick={async () => {
                          await removeFixedPayment(fp.id);
                          showToast("Paiement supprimé", "info");
                        }}
                        className="text-slate-600 hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              }
              if (item.kind === "income") {
                const inc = item.data;
                return (
                  <div key={`i-${inc.id}`} className="rounded-xl border border-white/5 bg-white/[0.03] p-3.5" style={{ borderLeft: "3px solid rgb(52 211 153 / 0.7)" }}>
                    <div className="flex justify-between items-start mb-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{inc.description}</div>
                        <div className="text-[10px] text-emerald-400/90 mt-1">Revenu · {getIncomeSourceLabel(inc.source)}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">{getAccountName(inc.account_id)}</div>
                        <div className="font-mono text-[10px] text-slate-500 mt-1">
                          {new Date(inc.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                          {inc.time && inc.time !== "00:00" && ` ${inc.time}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="font-mono text-sm font-bold text-emerald-400">+{formatCFA(inc.amount)}</span>
                        <button onClick={() => handleDeleteIncome(inc.id)} className="text-slate-500 active:text-red-400 p-1.5">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }
              if (item.kind === "transfer") {
                const xfer = item.data;
                const fee = xfer.fee ?? 0;
                return (
                  <div key={`t-${xfer.id}`} className="rounded-xl border border-white/5 bg-white/[0.03] p-3.5" style={{ borderLeft: "3px solid rgb(251 146 60 / 0.55)" }}>
                    <div className="flex justify-between items-start mb-1.5 gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{xfer.notes?.trim() ? xfer.notes : "Transfert entre comptes"}</div>
                        <div className="text-[9px] text-slate-500 mt-1">
                          {getAccountName(xfer.from_account_id)} → {getAccountName(xfer.to_account_id)}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500 mt-1">
                          {new Date(xfer.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                          {xfer.time && xfer.time !== "00:00" && ` ${xfer.time}`}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono text-sm font-bold text-orange-400">↔ {formatCFA(xfer.amount)}</div>
                        {fee > 0 && <div className="text-[10px] text-slate-500">frais {formatCFA(fee)}</div>}
                        <button onClick={() => handleDeleteTransfer(xfer.id)} className="text-slate-500 active:text-red-400 p-1.5 mt-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }
              const exp = item.data;
              const cat = getCategoryDisplay(exp.category);
              return (
                <div key={`e-${exp.id}`} className="rounded-xl border border-white/5 bg-white/[0.03] p-3.5" style={{ borderLeft: `3px solid ${cat.color}` }}>
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{exp.description}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                          style={{ background: cat.color + "22", color: cat.color }}
                        >
                          <Icon name={cat.icon} size={10} />
                          {cat.label}
                        </span>
                        <span className="text-[9px] text-slate-500">{getAccountName(exp.account_id)}</span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {new Date(exp.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                          {exp.time && exp.time !== "00:00" && ` ${exp.time}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <span className="font-mono text-sm font-bold text-red-400">-{getExpenseTotalLabel(exp)}</span>
                      <button onClick={() => handleEditExpense(exp)} className="text-slate-500 active:text-emerald-400 p-1.5" title="Modifier">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(exp.id)} className="text-slate-500 active:text-red-400 p-1.5">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {totalPages > 1 && (
              <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4 mt-2">
                <p className="text-center text-xs text-neutral-500">
                  <span className="text-neutral-300 font-mono">
                    {listRangeStart}–{listRangeEnd}
                  </span>{" "}
                  sur {filteredHistory.length}
                  <span className="text-neutral-600">
                    {" "}
                    · page {currentPage}/{totalPages}
                  </span>
                  <span className="block text-[10px] text-neutral-600 mt-1">{EXPENSES_PAGE_SIZE} par page</span>
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-white/10 py-2.5 text-xs font-medium text-neutral-300 disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                    Précédent
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-white/10 py-2.5 text-xs font-medium text-neutral-300 disabled:opacity-40"
                  >
                    Suivant
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section dépenses planifiées */}
      {(pendingPlanned.length > 0 || executedPlanned.length > 0) && (
        <div ref={plannedSectionRef} className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CalendarClock size={16} className="text-emerald-400" /> Dépenses planifiées
            </h3>
            <button
              onClick={openNewPlanModal}
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors"
            >
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
                    className={`rounded-xl border p-3.5 transition-all ${
                      isHighlighted
                        ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-[var(--bg-primary)] border-emerald-500/60 bg-emerald-500/5"
                        : "border-white/5 bg-white/[0.02] border-l-[3px] border-l-emerald-500/50"
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
              <summary className="text-[10px] text-neutral-500 cursor-pointer hover:text-neutral-400 flex items-center gap-1 mb-2">
                <CircleCheck size={12} className="text-emerald-500" /> {executedPlanned.length} exécutée{executedPlanned.length > 1 ? "s" : ""}
              </summary>
              <div className="space-y-1.5">
                {executedPlanned.slice(0, 5).map((p) => (
                  <div key={p.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5 flex items-center gap-3 opacity-60">
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
        <div className="mt-6">
          <button
            onClick={openNewPlanModal}
            className="w-full rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center hover:bg-white/[0.04] transition-colors group"
          >
            <CalendarClock size={28} className="mx-auto mb-2 text-neutral-500 group-hover:text-emerald-400 transition-colors" />
            <p className="text-sm text-neutral-500 group-hover:text-neutral-400">Planifier une dépense à venir</p>
          </button>
        </div>
      )}

      {/* ── Historique par période ── */}
      <HistoryByPeriod config={config} selectedYear={selectedYear} getCategoryDisplay={getCategoryDisplay} />

      {/* Modal — Planifier / Modifier une dépense */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={closePlanModal}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl popup-panel p-6 sm:p-8 max-h-[90dvh] overflow-y-auto shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-bold flex items-center gap-2">
                {editingPlanned ? (
                  <><Pencil size={18} className="text-emerald-400" /> Modifier la dépense</>
                ) : (
                  <><CalendarClock size={18} className="text-emerald-400" /> Planifier une dépense</>
                )}
              </h2>
              <button onClick={closePlanModal} className="text-neutral-400 hover:text-white p-1 transition-colors"><X size={20} /></button>
            </div>
            <div className="grid gap-4">
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Date d&apos;échéance</label>
                <input type="date" className="input-field" value={planForm.due_date}
                  onChange={(e) => setPlanForm({ ...planForm, due_date: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Description</label>
                <input className="input-field" placeholder="Ex: Renouveler abonnement, Achat prévu..."
                  value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-500 mb-1.5 block">Catégorie</label>
                  <select className="input-field" value={planForm.category}
                    onChange={(e) => setPlanForm({ ...planForm, category: e.target.value })}>
                    {config.categories.map((c: Category) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-neutral-500 mb-1.5 block">Montant (FCFA)</label>
                  <input type="number" className="input-field font-mono" placeholder="0"
                    value={planForm.amount} onChange={(e) => setPlanForm({ ...planForm, amount: e.target.value })} />
                </div>
              </div>
              <AccountSelect
                accounts={accountsWithBalance}
                value={
                  planForm.account_id > 0
                    ? planForm.account_id
                    : firstDebitAccountId ?? 0
                }
                onChange={(id) => setPlanForm({ ...planForm, account_id: id })}
                label="Payer depuis (à l’exécution)"
                filterType="debit"
                excludeVault
                debitAmount={
                  Number(planForm.amount) > 0 ? Number(planForm.amount) : undefined
                }
                id="planned-expense-account"
              />
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Notes (optionnel)</label>
                <input className="input-field" placeholder="Détails..."
                  value={planForm.notes} onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={closePlanModal} className="flex-1 min-h-[44px] py-3 rounded-lg border border-white/10 text-neutral-400 hover:text-white text-sm font-medium transition-colors">Annuler</button>
              <button onClick={handleSavePlan} className="btn-primary flex-1 min-h-[44px] py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5">
                {editingPlanned ? <><Check size={16} /> Enregistrer</> : <><CalendarClock size={16} /> Planifier</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Nouvelle dépense */}
      {showModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          onClick={closeExpenseModal}
        >
          <div
            className="w-full max-w-md rounded-2xl popup-panel p-6 sm:p-8 max-h-[90dvh] overflow-y-auto shadow-2xl flex-shrink-0"
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
                  <label className="text-xs text-neutral-500 mb-1.5 block">Date</label>
                  <input type="date" className="input-field" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 mb-1.5 block">Heure</label>
                  <input type="time" className="input-field" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Description</label>
                <input className="input-field" placeholder="Ex: Courses marché..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-500 mb-1.5 block">Catégorie</label>
                  <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {config.categories.map((c: Category) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-neutral-500 mb-1.5 block">Montant (FCFA)</label>
                  <input
                    type="number"
                    className="input-field font-mono"
                    placeholder="0"
                    value={form.amount}
                    onChange={(e) => {
                      const amt = e.target.value;
                      const feePct = expenseModalFeePct;
                      const suggested = feePct > 0 && amt ? Math.round(Number(amt) * feePct / 100) : "";
                      setForm({ ...form, amount: amt, transaction_fee: String(suggested) });
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Compte débité</label>
                <select
                  className="input-field"
                  value={form.account_id || (firstDebitAccountId ? String(firstDebitAccountId) : "")}
                  onChange={(e) => {
                    const account_id = e.target.value;
                    const nextId = account_id ? Number(account_id) : firstDebitAccountId;
                    const accRow =
                      expenseAccountOptions.find((a) => a.id === nextId) ?? expenseAccountOptions[0];
                    const feePct = suggestedTransactionFeePercentFromAccount(accRow?.kind, accRow?.subtype);
                    const suggested =
                      feePct > 0 && form.amount ? Math.round((Number(form.amount) * feePct) / 100) : "";
                    setForm({ ...form, account_id, transaction_fee: String(suggested) });
                  }}
                >
                  {expenseAccountOptions.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              {expenseModalFeePct > 0 && (
                <div>
                  <label className="text-xs text-neutral-500 mb-1.5 block">Frais de transaction (FCFA)</label>
                  <input
                    type="number"
                    className="input-field font-mono"
                    placeholder="0"
                    min="0"
                    value={form.transaction_fee}
                    onChange={(e) => setForm({ ...form, transaction_fee: e.target.value })}
                  />
                  <p className="text-[10px] text-slate-500 mt-1">~{expenseModalFeePct}% du montant (selon le type de compte). Modifiable si tes frais diffèrent.</p>
                </div>
              )}
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Notes (optionnel)</label>
                <input className="input-field" placeholder="Notes..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={closeExpenseModal} className="flex-1 min-h-[44px] py-3 rounded-lg border border-white/10 text-neutral-400 hover:text-white text-sm font-medium transition-colors">
                Annuler
              </button>
              <button onClick={handleSubmit} className="btn-primary flex-1 min-h-[44px] py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5">
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

function HistoryByPeriod({
  config,
  selectedYear,
  getCategoryDisplay,
}: {
  config: BudgetConfig;
  selectedYear: number;
  getCategoryDisplay: (categoryId: string) => { label: string; icon: string; color: string };
}) {
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
        className="w-full rounded-xl border border-white/5 bg-white/[0.02] p-4 flex items-center justify-between hover:bg-white/[0.04] transition-colors"
      >
        <span className="text-sm font-bold flex items-center gap-2">
          <History size={16} className="text-emerald-400" /> Dépenses variables (autre période)
        </span>
        <ChevronRight size={16} className={`text-neutral-500 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 animate-slide-up">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(PERIOD_LABELS) as PeriodType[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                  period === p ? "bg-emerald-500/30 text-emerald-300 ring-1 ring-emerald-500/50" : "bg-white/5 text-neutral-500 hover:bg-white/10"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <button onClick={navigatePrev} disabled={!canPrev}
              className="p-1.5 rounded-lg hover:bg-white/5 text-neutral-500 disabled:opacity-30 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <div className="text-center">
              {period === "day" ? (
                <input type="date" className="input-field text-xs text-center" value={dayDate}
                  onChange={(e) => setDayDate(e.target.value)} />
              ) : (
                <span className="text-xs font-semibold text-neutral-300">{range.label}</span>
              )}
            </div>
            <button onClick={navigateNext} disabled={!canNext}
              className="p-1.5 rounded-lg hover:bg-white/5 text-neutral-500 disabled:opacity-30 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
              <div className="text-[10px] text-neutral-500">Total période</div>
              <div className="font-mono text-sm font-bold text-red-400 mt-0.5">{formatCFA(totalHistory)}</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
              <div className="text-[10px] text-neutral-500">Moyenne / jour</div>
              <div className="font-mono text-sm font-bold text-red-400 mt-0.5">{formatCFA(avgDaily)}</div>
            </div>
          </div>

          {loadingHistory ? (
            <div className="text-center py-6 text-neutral-500 text-xs">Chargement...</div>
          ) : historyData.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] py-8 text-center text-neutral-500">
              <Calendar size={28} className="mx-auto mb-2 text-neutral-600" />
              <p className="text-xs">Aucune dépense sur cette période</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedByDate.map(([date, items]) => {
                const dayTotal = items.reduce((s, e) => s + e.amount, 0);
                return (
                  <div key={date} className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                    <div className="flex justify-between items-center px-3.5 py-2 bg-white/[0.03] border-b border-white/5">
                      <span className="text-[11px] font-semibold text-neutral-500">
                        {new Date(date).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short", year: period === "year" ? "numeric" : undefined })}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-red-400">-{formatCFA(dayTotal)}</span>
                    </div>
                    {items.map((e) => {
                      const cat = getCategoryDisplay(e.category);
                      return (
                        <div key={e.id} className="flex items-center gap-3 px-3.5 py-2 border-b border-white/[0.02] last:border-0">
                          <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                            style={{ background: cat.color + "22" }}>
                            <Icon name={cat.icon} size={12} style={{ color: cat.color }} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs truncate">{e.description}</div>
                            {e.time && e.time !== "00:00" && (
                              <div className="text-[9px] text-neutral-500">{e.time}</div>
                            )}
                          </div>
                          <span className="font-mono text-xs font-semibold text-red-300 shrink-0">-{formatCFA(e.amount + (e.transaction_fee ?? 0))}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-center text-[10px] text-neutral-500 pt-1">
            {historyData.length} transaction{historyData.length > 1 ? "s" : ""} · {groupedByDate.length} jour{groupedByDate.length > 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
