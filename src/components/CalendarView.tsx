"use client";
import { useState, useMemo } from "react";
import { formatCFA, MONTHS_FULL } from "@/lib/constants";
import { BudgetConfig, Expense, Income, FixedChargePayment, LoanPayment, Loan, CalendarEvent } from "@/lib/types";
import Icon from "./ui/Icon";
import {
  ChevronLeft, ChevronRight, Plus, X, Check, Wallet, HandCoins,
  TrendingDown, TrendingUp, Clock, ArrowDownCircle, ArrowUpCircle,
} from "lucide-react";

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const INCOME_SOURCES = [
  { id: "salary", label: "Salaire" },
  { id: "freelance", label: "Freelance" },
  { id: "gift", label: "Don / Cadeau" },
  { id: "refund", label: "Remboursement" },
  { id: "investment", label: "Investissement" },
  { id: "project", label: "Épargne projet" },
  { id: "loan_recovery", label: "Remboursement prêt reçu" },
  { id: "other", label: "Autre" },
];

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
  soldeNet: number;
  totalIncome: number;
}

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(month: number, year: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
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
    totalMonthSpent, totalFixed, totalMonthIncomes, monthLoanPayments, soldeNet, totalIncome,
  } = budget;

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
  });
  const [expenseForm, setExpenseForm] = useState({
    date: now.toISOString().split("T")[0],
    time: now.toTimeString().slice(0, 5),
    description: "",
    category: config.categories[0]?.id || "",
    amount: "",
    notes: "",
  });

  const events = useMemo<Record<string, CalendarEvent[]>>(() => {
    const map: Record<string, CalendarEvent[]> = {};
    expenses.forEach((e) => {
      const key = e.date;
      if (!map[key]) map[key] = [];
      map[key].push({
        id: e.id, type: "expense", date: e.date, time: e.time || "00:00",
        description: e.description, amount: e.amount, category: e.category,
      });
    });
    incomes.forEach((i) => {
      const key = i.date;
      if (!map[key]) map[key] = [];
      map[key].push({
        id: i.id, type: "income", date: i.date, time: i.time || "00:00",
        description: i.description, amount: i.amount, source: i.source,
      });
    });
    fixedPayments.forEach((fp) => {
      const key = fp.date;
      if (!map[key]) map[key] = [];
      map[key].push({
        id: fp.id, type: "fixed", date: fp.date, time: fp.time || "00:00",
        description: fp.label, amount: fp.amount, icon: fp.icon,
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
    const map: Record<string, { income: number; expense: number; fixed: number; loan: number }> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayEvents = events[key] || [];
      map[key] = {
        income: dayEvents.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0),
        expense: dayEvents.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0),
        fixed: dayEvents.filter((e) => e.type === "fixed").reduce((s, e) => s + e.amount, 0),
        loan: dayEvents.filter((e) => e.type === "loan").reduce((s, e) => s + e.amount, 0),
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
    const ok = await addIncome({ ...incomeForm, amount: Number(incomeForm.amount), time: incomeForm.time || "00:00" });
    if (ok) {
      showToast("Revenu enregistré !");
      const n = new Date();
      setIncomeForm({
        date: n.toISOString().split("T")[0],
        time: n.toTimeString().slice(0, 5),
        description: "", source: "other", amount: "", notes: "",
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
    const ok = await addExpense({ ...expenseForm, amount: Number(expenseForm.amount), time: expenseForm.time || "00:00" });
    if (ok) {
      showToast("Dépense enregistrée !");
      const n = new Date();
      setExpenseForm({
        date: n.toISOString().split("T")[0],
        time: n.toTimeString().slice(0, 5),
        description: "", category: config.categories[0]?.id || "", amount: "", notes: "",
      });
      setShowExpenseModal(false);
    }
  };

  const handleDeleteEvent = async (ev: CalendarEvent) => {
    if (ev.type === "expense") {
      await removeExpense(ev.id);
      showToast("Dépense supprimée", "info");
    } else if (ev.type === "fixed") {
      await removeFixedPayment(ev.id);
      showToast("Paiement supprimé", "info");
    } else if (ev.type === "loan") {
      await removeLoanPayment(ev.id);
      showToast("Remboursement supprimé", "info");
    } else {
      await removeIncome(ev.id);
      showToast("Revenu supprimé", "info");
    }
  };

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-5 lg:mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold">Calendrier</h1>
            <p className="text-slate-500 text-xs lg:text-sm mt-0.5">
              Suivi journalier des entrées et sorties
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setShowExpenseModal(true)}
              className="px-3 py-2.5 lg:px-4 rounded-xl text-xs lg:text-sm font-semibold flex items-center gap-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
              <TrendingDown size={14} /> <span className="hidden sm:inline">Dépense</span>
            </button>
            <button onClick={() => setShowIncomeModal(true)}
              className="btn-primary px-3 py-2.5 lg:px-4 rounded-xl text-xs lg:text-sm font-semibold flex items-center gap-1.5">
              <TrendingUp size={14} /> <span className="hidden sm:inline">Revenu</span>
            </button>
          </div>
        </div>
      </div>

      {/* Monthly summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 lg:gap-4 mb-5 lg:mb-6">
        <div className="glass rounded-xl lg:rounded-2xl p-3 lg:p-5">
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowUpCircle size={14} className="text-emerald-400" />
            <span className="text-[9px] lg:text-[11px] text-slate-500">Revenus</span>
          </div>
          <div className="font-mono text-sm lg:text-xl font-bold text-emerald-400">
            +{formatCFA(totalIncome)}
          </div>
        </div>
        <div className="glass rounded-xl lg:rounded-2xl p-3 lg:p-5">
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowDownCircle size={14} className="text-orange-400" />
            <span className="text-[9px] lg:text-[11px] text-slate-500">Charges</span>
          </div>
          <div className="font-mono text-sm lg:text-xl font-bold text-orange-400">
            -{formatCFA(totalFixed)}
          </div>
        </div>
        <div className="glass rounded-xl lg:rounded-2xl p-3 lg:p-5">
          <div className="flex items-center gap-1.5 mb-1">
            <HandCoins size={14} className="text-teal-400" />
            <span className="text-[9px] lg:text-[11px] text-slate-500">Prêts</span>
          </div>
          <div className="font-mono text-sm lg:text-xl font-bold text-teal-400">
            -{formatCFA(monthLoanPayments)}
          </div>
        </div>
        <div className="glass rounded-xl lg:rounded-2xl p-3 lg:p-5">
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowDownCircle size={14} className="text-amber-400" />
            <span className="text-[9px] lg:text-[11px] text-slate-500">Dépenses</span>
          </div>
          <div className="font-mono text-sm lg:text-xl font-bold text-amber-400">
            -{formatCFA(totalMonthSpent)}
          </div>
        </div>
        <div className="glass rounded-xl lg:rounded-2xl p-3 lg:p-5">
          <div className="flex items-center gap-1.5 mb-1">
            <Wallet size={14} className={soldeNet >= 0 ? "text-emerald-400" : "text-red-400"} />
            <span className="text-[9px] lg:text-[11px] text-slate-500">Solde</span>
          </div>
          <div className={`font-mono text-sm lg:text-xl font-bold ${soldeNet >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {soldeNet >= 0 ? "+" : "-"}{formatCFA(Math.abs(soldeNet))}
          </div>
        </div>
      </div>

      {/* Month navigator */}
      <div className="glass-strong rounded-2xl p-4 lg:p-6 mb-5 lg:mb-6">
        <div className="flex justify-between items-center mb-4">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-sm lg:text-base font-semibold">
            {MONTHS_FULL[selectedMonth]} {selectedYear}
          </h2>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS_FR.map((d) => (
            <div key={d} className="text-center text-[9px] lg:text-[11px] text-slate-500 font-medium py-1">
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
            const hasEvents = totals && (totals.income > 0 || totals.expense > 0 || totals.fixed > 0 || totals.loan > 0);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`relative rounded-xl p-1 lg:p-1.5 min-h-[52px] lg:min-h-[68px] flex flex-col items-center transition-all border
                  ${isSelected
                    ? "bg-emerald-500/20 border-emerald-500/50"
                    : isToday
                      ? "bg-white/[0.04] border-emerald-500/30"
                      : "border-transparent hover:bg-white/[0.03]"
                  }`}
              >
                <span className={`text-[11px] lg:text-xs font-medium mb-0.5
                  ${isToday ? "text-emerald-400 font-bold" : "text-slate-300"}`}>
                  {day}
                </span>
                {hasEvents && (
                  <div className="flex flex-col items-center gap-0.5 mt-auto">
                    {totals.income > 0 && (
                      <div className="text-[7px] lg:text-[8px] font-mono text-emerald-400 leading-tight">
                        +{totals.income >= 1000 ? `${Math.round(totals.income / 1000)}k` : totals.income}
                      </div>
                    )}
                    {totals.fixed > 0 && (
                      <div className="text-[7px] lg:text-[8px] font-mono text-orange-400 leading-tight">
                        -{totals.fixed >= 1000 ? `${Math.round(totals.fixed / 1000)}k` : totals.fixed}
                      </div>
                    )}
                    {totals.loan > 0 && (
                      <div className="text-[7px] lg:text-[8px] font-mono text-teal-400 leading-tight">
                        -{totals.loan >= 1000 ? `${Math.round(totals.loan / 1000)}k` : totals.loan}
                      </div>
                    )}
                    {totals.expense > 0 && (
                      <div className="text-[7px] lg:text-[8px] font-mono text-red-400 leading-tight">
                        -{totals.expense >= 1000 ? `${Math.round(totals.expense / 1000)}k` : totals.expense}
                      </div>
                    )}
                  </div>
                )}
                {hasEvents && (
                  <div className="absolute bottom-1 flex gap-0.5">
                    {totals.income > 0 && <span className="w-1 h-1 rounded-full bg-emerald-400" />}
                    {totals.expense > 0 && <span className="w-1 h-1 rounded-full bg-red-400" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <div className="glass-strong rounded-2xl p-4 lg:p-6 animate-slide-up">
          <h3 className="text-sm lg:text-base font-semibold mb-3 lg:mb-4 flex items-center gap-2">
            <Clock size={16} className="text-emerald-400" />
            {new Date(selectedDate + "T00:00:00").toLocaleDateString("fr-FR", {
              weekday: "long", day: "numeric", month: "long",
            })}
          </h3>
          {selectedEvents.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              Aucune transaction ce jour
            </div>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((ev) => {
                const cat = ev.type === "expense"
                  ? config.categories.find((c) => c.id === ev.category)
                  : null;
                const src = ev.type === "income"
                  ? INCOME_SOURCES.find((s) => s.id === ev.source) || INCOME_SOURCES[INCOME_SOURCES.length - 1]
                  : null;
                const bgColor = ev.type === "expense"
                  ? (cat?.color || "#ef4444") + "22"
                  : ev.type === "fixed"
                  ? "rgba(249,115,22,0.15)"
                  : ev.type === "loan"
                  ? "rgba(168,85,247,0.15)"
                  : "rgba(16,185,129,0.15)";
                return (
                  <div key={`${ev.type}-${ev.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
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
                        <span className="text-[9px] lg:text-[10px] text-slate-500">
                          {ev.time !== "00:00" ? ev.time : ""}
                        </span>
                        {cat && (
                          <span className="text-[9px] lg:text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{ background: cat.color + "22", color: cat.color }}>
                            {cat.label}
                          </span>
                        )}
                        {ev.type === "fixed" && (
                          <span className="text-[9px] lg:text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
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
                        ev.type === "income" ? "text-emerald-400" : ev.type === "fixed" ? "text-orange-300" : ev.type === "loan" ? "text-teal-300" : "text-amber-400"
                      }`}>
                        {ev.type === "income" ? "+" : "-"}{formatCFA(ev.amount)}
                      </span>
                      <button onClick={() => handleDeleteEvent(ev)}
                        className="text-slate-600 hover:text-red-400 active:text-red-400 transition-colors p-1">
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
          onClick={() => setShowIncomeModal(false)}>
          <div className="glass-strong w-full sm:w-[480px] rounded-t-2xl sm:rounded-2xl p-6 lg:p-8 animate-slide-up min-h-[85dvh] sm:min-h-0 max-h-[95dvh] overflow-y-auto"
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
                  <label className="text-xs text-slate-400 mb-1 block">Date</label>
                  <input type="date" className="input-field" value={incomeForm.date}
                    onChange={(e) => setIncomeForm({ ...incomeForm, date: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Heure</label>
                  <input type="time" className="input-field" value={incomeForm.time}
                    onChange={(e) => setIncomeForm({ ...incomeForm, time: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Description</label>
                <input className="input-field" placeholder="Ex: Salaire mars, Freelance..."
                  value={incomeForm.description} onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Source</label>
                  <select className="input-field" value={incomeForm.source}
                    onChange={(e) => setIncomeForm({ ...incomeForm, source: e.target.value })}>
                    {INCOME_SOURCES.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Montant (FCFA)</label>
                  <input type="number" className="input-field font-mono" placeholder="0"
                    value={incomeForm.amount} onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Notes (optionnel)</label>
                <input className="input-field" placeholder="Notes..."
                  value={incomeForm.notes} onChange={(e) => setIncomeForm({ ...incomeForm, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowIncomeModal(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm">Annuler</button>
              <button onClick={handleAddIncome}
                className="btn-primary flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5">
                <Check size={16} /> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Ajouter une dépense */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
          onClick={() => setShowExpenseModal(false)}>
          <div className="glass-strong w-full sm:w-[480px] rounded-t-2xl sm:rounded-2xl p-6 lg:p-8 animate-slide-up min-h-[85dvh] sm:min-h-0 max-h-[95dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base lg:text-lg font-bold flex items-center gap-2">
                <TrendingDown size={18} className="text-red-400" /> Nouvelle Dépense
              </h2>
              <button onClick={() => setShowExpenseModal(false)} className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Date</label>
                  <input type="date" className="input-field" value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Heure</label>
                  <input type="time" className="input-field" value={expenseForm.time}
                    onChange={(e) => setExpenseForm({ ...expenseForm, time: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Description</label>
                <input className="input-field" placeholder="Ex: Courses marché..."
                  value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Catégorie</label>
                  <select className="input-field" value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                    {config.categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Montant (FCFA)</label>
                  <input type="number" className="input-field font-mono" placeholder="0"
                    value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Notes (optionnel)</label>
                <input className="input-field" placeholder="Notes..."
                  value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowExpenseModal(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm">Annuler</button>
              <button onClick={handleAddExpense}
                className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 text-white"
                style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}>
                <Check size={16} /> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
