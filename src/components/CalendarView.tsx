"use client";
import { useState, useMemo } from "react";
import { formatCFA, MONTHS_FULL, accountHasActiveOutgoingLock } from "@/lib/constants";
import { BudgetConfig, Expense, Income, FixedChargePayment, LoanPayment, Loan, CalendarEvent, AccountWithBalance } from "@/lib/types";
import Icon from "./ui/Icon";
import {
  ChevronLeft, ChevronRight, Plus, X, Check, Wallet, HandCoins,
  TrendingDown, TrendingUp, Clock, ArrowDownCircle, ArrowUpCircle,
} from "lucide-react";
import { INCOME_TYPE_OPTIONS, getIncomeSourceLabel } from "@/lib/incomeSources";

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

interface BudgetData {
  config: BudgetConfig;
  expenses: Expense[];
  incomes: Income[];
  fixedPayments: FixedChargePayment[];
  loanPayments: LoanPayment[];
  loans: Loan[];
  selectedMonth: number;
  selectedYear: number;
  setSelectedYear: (y: number) => void;
  setSelectedMonth: (m: number) => void;
  addExpense: (exp: Omit<Expense, "id" | "created_at">) => Promise<boolean>;
  addIncome: (inc: Omit<Income, "id" | "created_at">) => Promise<boolean>;
  removeIncome: (id: number) => Promise<void>;
  removeExpense: (id: number) => Promise<void>;
  removeFixedPayment: (id: number) => Promise<void>;
  removeLoanPayment: (id: number) => Promise<void>;
  totalMonthSpent: number;
  totalFixed: number;
  totalMonthIncomes: number;
  monthLoanPayments: number;
  soldeDisponibleLiquide: number;
  totalActifsKpi: number;
  totalIncome: number;
  accountsWithBalance: AccountWithBalance[];
}

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(month: number, year: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function formatShort(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

export default function CalendarView({
  budget,
  showToast,
}: {
  budget: BudgetData;
  showToast: (m: string, t?: string) => void;
}) {
  const {
    config, expenses, incomes, fixedPayments, loanPayments, loans, selectedMonth, selectedYear, setSelectedYear,
    setSelectedMonth, addExpense, addIncome, removeIncome, removeExpense, removeFixedPayment, removeLoanPayment,
    totalMonthSpent,
    totalFixed,
    totalMonthIncomes,
    monthLoanPayments,
    soldeDisponibleLiquide,
    totalActifsKpi,
    totalIncome,
    accountsWithBalance,
  } = budget;

  const activeAccounts = useMemo(() => accountsWithBalance.filter((a) => !a.is_archived), [accountsWithBalance]);
  const debitAccounts = useMemo(
    () => activeAccounts.filter((a) => !accountHasActiveOutgoingLock(a.kind, a.vault_unlocks_on)),
    [activeAccounts],
  );
  const defaultAccountId = activeAccounts[0]?.id;
  const defaultExpenseAccountId = debitAccounts[0]?.id;

  const loansById = useMemo(() => {
    const map: Record<number, Loan> = {};
    loans.forEach((l) => { map[l.id] = l; });
    return map;
  }, [loans]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const now = new Date();
  const [incomeForm, setIncomeForm] = useState({
    date: now.toISOString().split("T")[0],
    time: now.toTimeString().slice(0, 5),
    description: "",
    source: "other",
    amount: "",
    notes: "",
    account_id: "" as string,
  });
  const [expenseForm, setExpenseForm] = useState({
    date: now.toISOString().split("T")[0],
    time: now.toTimeString().slice(0, 5),
    description: "",
    category: config.categories[0]?.id || "",
    amount: "",
    notes: "",
    account_id: "" as string,
  });

  const events = useMemo<Record<string, (CalendarEvent & { eventKey: string })[]>>(() => {
    const map: Record<string, (CalendarEvent & { eventKey: string })[]> = {};
    expenses.forEach((e) => {
      const key = e.date;
      if (!map[key]) map[key] = [];
      map[key].push({
        id: e.id, type: "expense", date: e.date, time: e.time || "00:00",
        description: e.description, amount: e.amount + (e.transaction_fee ?? 0), category: e.category,
        eventKey: `expense-${e.id}`,
      });
    });
    incomes.forEach((i) => {
      const key = i.date;
      if (!map[key]) map[key] = [];
      map[key].push({
        id: i.id, type: "income", date: i.date, time: i.time || "00:00",
        description: i.description, amount: i.amount, source: i.source,
        eventKey: `income-${i.id}`,
      });
    });
    fixedPayments.forEach((fp) => {
      const key = fp.date;
      if (!map[key]) map[key] = [];
      map[key].push({
        id: fp.id, type: "fixed", date: fp.date, time: fp.time || "00:00",
        description: fp.label, amount: fp.amount, icon: fp.icon,
        eventKey: `fixed-${fp.id}`,
      });
    });
    loanPayments.forEach((lp) => {
      const key = lp.date;
      if (!map[key]) map[key] = [];
      const loan = loansById[lp.loan_id];
      const isRecovery = loan?.type === "personal_lent";
      map[key].push({
        id: lp.id,
        type: isRecovery ? "income" : "loan",
        date: lp.date,
        time: lp.time || "00:00",
        description: isRecovery
          ? `Remb. reçu${loan?.lender_borrower ? ` de ${loan.lender_borrower}` : ""}${lp.notes ? ` — ${lp.notes}` : ""}`
          : `Remb.${loan?.label ? ` ${loan.label}` : ""}${lp.notes ? ` — ${lp.notes}` : ""}`,
        amount: lp.amount + lp.fees,
        icon: isRecovery ? "arrow-down-left" : "hand-coins",
        source: isRecovery ? "loan_recovery" : undefined,
        eventKey: isRecovery ? `loan_recovery-${lp.id}` : `loan-${lp.id}`,
      });
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => b.time.localeCompare(a.time))
    );
    return map;
  }, [expenses, incomes, fixedPayments, loanPayments, loansById]);

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
  const firstDay = getFirstDayOfWeek(selectedMonth, selectedYear);
  const todayStr = new Date().toISOString().split("T")[0];

  const prevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(selectedYear - 1); }
    else setSelectedMonth(selectedMonth - 1);
  };
  const nextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(selectedYear + 1); }
    else setSelectedMonth(selectedMonth + 1);
  };

  const dayTotals = useMemo(() => {
    const map: Record<string, { income: number; expense: number; fixed: number; loan: number; totalIn: number; totalOut: number }> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayEvents = events[key] || [];
      const income = dayEvents.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
      const expense = dayEvents.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
      const fixed = dayEvents.filter((e) => e.type === "fixed").reduce((s, e) => s + e.amount, 0);
      const loan = dayEvents.filter((e) => e.type === "loan").reduce((s, e) => s + e.amount, 0);
      map[key] = {
        income, expense, fixed, loan,
        totalIn: income,
        totalOut: expense + fixed + loan,
      };
    }
    return map;
  }, [events, daysInMonth, selectedMonth, selectedYear]);

  const selectedEvents = selectedDate ? (events[selectedDate] || []) : [];

  const handleAddIncome = async () => {
    if (!incomeForm.description || !incomeForm.amount || Number(incomeForm.amount) <= 0) {
      showToast("Remplis tous les champs", "error");
      return;
    }
    const acc = incomeForm.account_id ? Number(incomeForm.account_id) : defaultAccountId;
    const ok = await addIncome({ ...incomeForm, amount: Number(incomeForm.amount), time: incomeForm.time || "00:00", account_id: acc });
    if (ok) {
      showToast("Revenu enregistré !");
      const n = new Date();
      setIncomeForm({
        date: n.toISOString().split("T")[0],
        time: n.toTimeString().slice(0, 5),
        description: "", source: "other", amount: "", notes: "",
        account_id: defaultAccountId ? String(defaultAccountId) : "",
      });
      setShowIncomeModal(false);
    }
  };

  const handleAddExpense = async () => {
    if (!expenseForm.description || !expenseForm.amount || Number(expenseForm.amount) <= 0) {
      showToast("Remplis tous les champs", "error");
      return;
    }
    if (!expenseForm.category) {
      showToast("Ajoute d'abord une catégorie dans les réglages", "error");
      return;
    }
    if (!defaultExpenseAccountId) {
      showToast("Aucun compte utilisable pour une dépense (coffres verrouillés ?).", "error");
      return;
    }
    const acc = expenseForm.account_id ? Number(expenseForm.account_id) : defaultExpenseAccountId;
    const ok = await addExpense({ ...expenseForm, amount: Number(expenseForm.amount), time: expenseForm.time || "00:00", account_id: acc });
    if (ok) {
      showToast("Dépense enregistrée !");
      const n = new Date();
      setExpenseForm({
        date: n.toISOString().split("T")[0],
        time: n.toTimeString().slice(0, 5),
        description: "", category: config.categories[0]?.id || "", amount: "", notes: "",
        account_id: defaultExpenseAccountId ? String(defaultExpenseAccountId) : "",
      });
      setShowExpenseModal(false);
    }
  };

  const handleDeleteEvent = async (ev: CalendarEvent & { eventKey?: string }) => {
    const key = ev.eventKey ?? `${ev.type}-${ev.id}`;
    if (ev.type === "expense") {
      await removeExpense(ev.id);
      showToast("Dépense supprimée", "info");
    } else if (ev.type === "fixed") {
      await removeFixedPayment(ev.id);
      showToast("Paiement supprimé", "info");
    } else if (ev.type === "loan" || key.startsWith("loan_recovery-")) {
      await removeLoanPayment(ev.id);
      showToast(key.startsWith("loan_recovery-") ? "Encaissement supprimé" : "Remboursement supprimé", "info");
    } else {
      await removeIncome(ev.id);
      showToast("Revenu supprimé", "info");
    }
  };

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight">Calendrier</h1>
          <p className="text-neutral-500 text-xs lg:text-sm mt-1">
            Suivi journalier des entrées et sorties — {MONTHS_FULL[selectedMonth]} {selectedYear}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setShowExpenseModal(true)}
            className="px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <TrendingDown size={16} strokeWidth={2.5} />
            Dépense
          </button>
          <button
            onClick={() => setShowIncomeModal(true)}
            className="btn-primary px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <TrendingUp size={16} strokeWidth={2.5} />
            Revenu
          </button>
        </div>
      </div>

      {/* Monthly summary */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Actifs", value: `+${formatCFA(totalActifsKpi)}`, color: "text-emerald-400", icon: ArrowUpCircle },
            { label: "Revenus (mois)", value: `+${formatCFA(totalIncome)}`, color: "text-emerald-400/90", icon: ArrowUpCircle },
            { label: "Charges fixes", value: `-${formatCFA(totalFixed)}`, color: "text-red-500", icon: ArrowDownCircle },
            { label: "Prêts", value: `-${formatCFA(monthLoanPayments)}`, color: "text-teal-400", icon: HandCoins },
            { label: "Dépenses variables", value: `-${formatCFA(totalMonthSpent)}`, color: "text-red-400", icon: ArrowDownCircle },
            {
              label: "Liquide dispo.",
              value: `${soldeDisponibleLiquide >= 0 ? "+" : "-"}${formatCFA(Math.abs(soldeDisponibleLiquide))}`,
              color: soldeDisponibleLiquide >= 0 ? "text-emerald-400" : "text-red-400",
              icon: Wallet,
            },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <s.icon size={16} className={`shrink-0 ${s.color}`} />
              <div>
                <div className="text-[10px] text-neutral-500">{s.label}</div>
                <div className={`font-mono text-sm font-bold ${s.color}`}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Month navigator & calendar */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 lg:p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-white/5 text-neutral-500 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h2 className="text-base font-semibold">
              {MONTHS_FULL[selectedMonth]} {selectedYear}
            </h2>
            {(selectedMonth !== now.getMonth() || selectedYear !== now.getFullYear()) && (
              <button
                onClick={() => { setSelectedMonth(now.getMonth()); setSelectedYear(now.getFullYear()); setSelectedDate(todayStr); }}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium"
              >
                Aujourd&apos;hui
              </button>
            )}
          </div>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-white/5 text-neutral-500 hover:text-white transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAYS_FR.map((d) => (
            <div key={d} className="text-center text-[10px] text-neutral-500 font-medium py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const totals = dayTotals[dateStr];
            const hasEvents = totals && (totals.totalIn > 0 || totals.totalOut > 0);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`relative rounded-lg p-1.5 lg:p-2 min-h-[56px] lg:min-h-[72px] flex flex-col items-center justify-start transition-all border
                  ${isSelected
                    ? "bg-emerald-500/20 border-emerald-500/50 ring-1 ring-emerald-500/30"
                    : isToday
                      ? "bg-white/[0.05] border-emerald-500/40"
                      : "border-white/5 hover:bg-white/[0.04]"
                  }`}
              >
                <span className={`text-[11px] lg:text-xs font-medium mb-0.5
                  ${isToday ? "text-emerald-400 font-bold" : "text-neutral-300"}`}>
                  {day}
                </span>
                {hasEvents && (
                  <div className="flex flex-col items-center gap-0.5 mt-auto w-full">
                    {totals.totalIn > 0 && (
                      <div className="text-[8px] lg:text-[9px] font-mono text-emerald-400 leading-tight" title={`Revenus: ${formatCFA(totals.totalIn)}`}>
                        +{formatShort(totals.totalIn)}
                      </div>
                    )}
                    {totals.totalOut > 0 && (
                      <div className="text-[8px] lg:text-[9px] font-mono text-red-400 leading-tight" title={`Dépenses: ${formatCFA(totals.totalOut)}`}>
                        -{formatShort(totals.totalOut)}
                      </div>
                    )}
                  </div>
                )}
                {hasEvents && (
                  <div className="absolute bottom-1 flex gap-0.5">
                    {totals.totalIn > 0 && <span className="w-1 h-1 rounded-full bg-emerald-400" />}
                    {totals.totalOut > 0 && <span className="w-1 h-1 rounded-full bg-red-400" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 lg:p-6 animate-slide-up">
          <h3 className="text-sm lg:text-base font-semibold mb-2 flex items-center gap-2">
            <Clock size={16} className="text-emerald-400" />
            {new Date(selectedDate + "T00:00:00").toLocaleDateString("fr-FR", {
              weekday: "long", day: "numeric", month: "long",
            })}
          </h3>
          {selectedEvents.length > 0 && (() => {
            const t = dayTotals[selectedDate];
            if (!t || (t.totalIn === 0 && t.totalOut === 0)) return null;
            return (
              <div className="flex flex-wrap gap-4 mb-4 py-3 px-4 rounded-lg bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-2">
                  <ArrowUpCircle size={16} className="text-emerald-400" />
                  <span className="text-xs text-neutral-500">Revenus</span>
                  <span className="font-mono text-sm font-bold text-emerald-400">+{formatCFA(t.totalIn)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowDownCircle size={16} className="text-red-400" />
                  <span className="text-xs text-neutral-500">Dépenses</span>
                  <span className="font-mono text-sm font-bold text-red-400">-{formatCFA(t.totalOut)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wallet size={16} className="text-slate-400" />
                  <span className="text-xs text-neutral-500">Solde jour</span>
                  <span className={`font-mono text-sm font-bold ${t.totalIn - t.totalOut >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {t.totalIn - t.totalOut >= 0 ? "+" : "-"}{formatCFA(Math.abs(t.totalIn - t.totalOut))}
                  </span>
                </div>
              </div>
            );
          })()}
          {selectedEvents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-neutral-500 text-sm mb-3">Aucune transaction ce jour</p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => { setExpenseForm({ ...expenseForm, date: selectedDate }); setShowExpenseModal(true); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-red-500/40 text-red-400 hover:bg-red-500/10 flex items-center gap-1.5">
                  <TrendingDown size={14} /> Dépense
                </button>
                <button onClick={() => { setIncomeForm({ ...incomeForm, date: selectedDate }); setShowIncomeModal(true); }}
                  className="btn-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5">
                  <TrendingUp size={14} /> Revenu
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((ev) => {
                const cat = ev.type === "expense"
                  ? config.categories.find((c) => c.id === ev.category)
                  : null;
                const src = ev.type === "income"
                  ? INCOME_TYPE_OPTIONS.find((s) => s.id === ev.source) || {
                      id: ev.source || "other",
                      label: getIncomeSourceLabel(ev.source || "other"),
                    }
                  : null;
                const bgColor = ev.type === "expense"
                  ? (cat?.color || "#ef4444") + "22"
                  : ev.type === "fixed"
                  ? "rgba(248,113,113,0.15)"
                  : ev.type === "loan"
                  ? "rgba(168,85,247,0.15)"
                  : "rgba(16,185,129,0.15)";
                return (
                  <div key={ev.eventKey ?? `${ev.type}-${ev.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: bgColor }}>
                      {ev.type === "expense" ? (
                        cat ? <Icon name={cat.icon} size={14} style={{ color: cat.color }} /> : <TrendingDown size={14} className="text-red-400" />
                      ) : ev.type === "fixed" ? (
                        <Icon name={ev.icon || "house"} size={14} className="text-orange-400" />
                      ) : ev.type === "loan" ? (
                        <HandCoins size={14} className="text-teal-400" />
                      ) : (
                        <TrendingUp size={14} className="text-emerald-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs lg:text-sm font-medium truncate">{ev.description}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] lg:text-[10px] text-neutral-500">
                          {ev.time !== "00:00" ? ev.time : ""}
                        </span>
                        {cat && (
                          <span className="text-[9px] lg:text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{ background: cat.color + "22", color: cat.color }}>
                            {cat.label}
                          </span>
                        )}
                        {ev.type === "fixed" && (
                          <span className="text-[9px] lg:text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">
                            Charge fixe
                          </span>
                        )}
                        {ev.type === "loan" && (
                          <span className="text-[9px] lg:text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-400">
                            Remb. prêt
                          </span>
                        )}
                        {src && (
                          <span className="text-[9px] lg:text-[10px] text-emerald-400/70">{src.label}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`font-mono text-sm font-bold ${
                        ev.type === "income" ? "text-emerald-400" : ev.type === "fixed" ? "text-red-500" : ev.type === "loan" ? "text-teal-300" : "text-red-400"
                      }`}>
                        {ev.type === "income" ? "+" : "-"}{formatCFA(ev.amount)}
                      </span>
                      <button onClick={() => handleDeleteEvent(ev)}
                        className="text-neutral-500 hover:text-red-400 transition-colors p-1">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal — Ajouter un revenu */}
      {showIncomeModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setShowIncomeModal(false)}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl popup-panel p-6 sm:p-8 max-h-[90dvh] overflow-y-auto shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base lg:text-lg font-bold flex items-center gap-2">
                <TrendingUp size={18} className="text-emerald-400" /> Nouveau Revenu
              </h2>
              <button onClick={() => setShowIncomeModal(false)} className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-500 mb-1.5 block">Date</label>
                  <input type="date" className="input-field" value={incomeForm.date}
                    onChange={(e) => setIncomeForm({ ...incomeForm, date: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 mb-1.5 block">Heure</label>
                  <input type="time" className="input-field" value={incomeForm.time}
                    onChange={(e) => setIncomeForm({ ...incomeForm, time: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Description</label>
                <input className="input-field" placeholder="Ex: Salaire mars, Freelance..."
                  value={incomeForm.description} onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Compte crédité</label>
                <select
                  className="input-field"
                  value={incomeForm.account_id || (defaultAccountId ? String(defaultAccountId) : "")}
                  onChange={(e) => setIncomeForm({ ...incomeForm, account_id: e.target.value })}
                >
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-500 mb-1.5 block">Source</label>
                  <select className="input-field" value={incomeForm.source}
                    onChange={(e) => setIncomeForm({ ...incomeForm, source: e.target.value })}>
                    {INCOME_TYPE_OPTIONS.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-neutral-500 mb-1.5 block">Montant (FCFA)</label>
                  <input type="number" className="input-field font-mono" placeholder="0"
                    value={incomeForm.amount} onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Notes (optionnel)</label>
                <input className="input-field" placeholder="Notes..."
                  value={incomeForm.notes} onChange={(e) => setIncomeForm({ ...incomeForm, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowIncomeModal(false)}
                className="flex-1 py-3 rounded-lg border border-white/10 text-neutral-400 hover:text-white text-sm font-medium transition-colors">Annuler</button>
              <button onClick={handleAddIncome}
                className="btn-primary flex-1 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5">
                <Check size={16} /> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Ajouter une dépense */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setShowExpenseModal(false)}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl popup-panel p-6 sm:p-8 max-h-[90dvh] overflow-y-auto shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base lg:text-lg font-bold flex items-center gap-2">
                <TrendingDown size={18} className="text-red-400" /> Nouvelle Dépense
              </h2>
              <button onClick={() => setShowExpenseModal(false)} className="text-neutral-400 hover:text-white p-1 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-500 mb-1.5 block">Date</label>
                  <input type="date" className="input-field" value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 mb-1.5 block">Heure</label>
                  <input type="time" className="input-field" value={expenseForm.time}
                    onChange={(e) => setExpenseForm({ ...expenseForm, time: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Description</label>
                <input className="input-field" placeholder="Ex: Courses marché..."
                  value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Compte débité</label>
                <select
                  className="input-field"
                  value={expenseForm.account_id || (defaultExpenseAccountId ? String(defaultExpenseAccountId) : "")}
                  onChange={(e) => setExpenseForm({ ...expenseForm, account_id: e.target.value })}
                >
                  {debitAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-500 mb-1.5 block">Catégorie</label>
                  <select className="input-field" value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                    {config.categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-neutral-500 mb-1.5 block">Montant (FCFA)</label>
                  <input type="number" className="input-field font-mono" placeholder="0"
                    value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Notes (optionnel)</label>
                <input className="input-field" placeholder="Notes..."
                  value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowExpenseModal(false)}
                className="flex-1 py-3 rounded-lg border border-white/10 text-neutral-400 hover:text-white text-sm font-medium transition-colors">Annuler</button>
              <button onClick={handleAddExpense}
                className="flex-1 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white transition-colors">
                <Check size={16} /> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
