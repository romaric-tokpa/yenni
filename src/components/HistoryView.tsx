"use client";
import { useState, useMemo, useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  formatCFA,
  MONTHS_FULL,
  MONTHS_SHORT,
  getSelectableYears,
  INCOME_SOURCE_SALARY_SETTINGS,
} from "@/lib/constants";

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("Fetch failed"))));
import { Expense, Income, FixedChargePayment, LoanPayment, Loan, Project, PlannedExpense, WishListItem, ShoppingListItem } from "@/lib/types";
import {
  History, ChevronLeft, ChevronRight, Calendar, RefreshCw,
  TrendingDown, TrendingUp, Landmark, HandCoins,
  Filter, ArrowDownCircle, ArrowUpCircle, Minus,
  PiggyBank, FolderOpen, CalendarClock, Banknote,
  FileDown, FileSpreadsheet, Heart, ShoppingCart,
} from "lucide-react";
import { exportHistoryCSV, exportHistoryPDF } from "@/lib/exportUtils";

type PeriodType = "day" | "month" | "quarter" | "semester" | "year";
type TxType = "all" | "expense" | "income" | "fixed" | "loan" | "saving" | "project" | "planned" | "wish" | "shopping";

interface UnifiedTx {
  id: string;
  date: string;
  time: string;
  description: string;
  amount: number;
  type: TxType;
  detail?: string;
  sign: "in" | "out" | "neutral";
}

const PERIOD_LABELS: Record<PeriodType, string> = {
  day: "Jour", month: "Mois", quarter: "Trimestre", semester: "Semestre", year: "Année",
};

const TX_FILTERS: { key: TxType; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "expense", label: "Dépenses" },
  { key: "income", label: "Revenus" },
  { key: "fixed", label: "Charges fixes" },
  { key: "loan", label: "Prêts" },
  { key: "saving", label: "Épargne" },
  { key: "project", label: "Projets" },
  { key: "planned", label: "Planifiées" },
  { key: "wish", label: "Envies" },
  { key: "shopping", label: "Courses" },
];

const QUARTER_LABELS = ["T1 (Jan–Mar)", "T2 (Avr–Jun)", "T3 (Jul–Sep)", "T4 (Oct–Déc)"];
const SEMESTER_LABELS = ["S1 (Jan–Jun)", "S2 (Jul–Déc)"];

function getDateRange(period: PeriodType, year: number, idx: number, dayDate: string) {
  switch (period) {
    case "day":
      return { start: dayDate, end: dayDate, label: new Date(dayDate).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }) };
    case "month": {
      const s = `${year}-${String(idx + 1).padStart(2, "0")}-01`;
      const ld = new Date(year, idx + 1, 0).getDate();
      return { start: s, end: `${year}-${String(idx + 1).padStart(2, "0")}-${String(ld).padStart(2, "0")}`, label: `${MONTHS_FULL[idx]} ${year}` };
    }
    case "quarter": {
      const sm = idx * 3; const em = sm + 2;
      const ld = new Date(year, em + 1, 0).getDate();
      return { start: `${year}-${String(sm + 1).padStart(2, "0")}-01`, end: `${year}-${String(em + 1).padStart(2, "0")}-${String(ld).padStart(2, "0")}`, label: `${QUARTER_LABELS[idx]} ${year}` };
    }
    case "semester": {
      const sm = idx * 6; const em = sm + 5;
      const ld = new Date(year, em + 1, 0).getDate();
      return { start: `${year}-${String(sm + 1).padStart(2, "0")}-01`, end: `${year}-${String(em + 1).padStart(2, "0")}-${String(ld).padStart(2, "0")}`, label: `${SEMESTER_LABELS[idx]} ${year}` };
    }
    case "year":
      return { start: `${year}-01-01`, end: `${year}-12-31`, label: `Année ${year}` };
  }
}

function txIcon(type: TxType) {
  switch (type) {
    case "expense": return <ArrowDownCircle size={14} className="text-amber-400" />;
    case "income": return <ArrowUpCircle size={14} className="text-emerald-400" />;
    case "fixed": return <Landmark size={14} className="text-orange-400" />;
    case "loan": return <HandCoins size={14} className="text-blue-400" />;
    case "saving": return <PiggyBank size={14} className="text-amber-400" />;
    case "project": return <FolderOpen size={14} className="text-emerald-400" />;
    case "planned": return <CalendarClock size={14} className="text-emerald-400" />;
    case "wish": return <Heart size={14} className="text-pink-400" />;
    case "shopping": return <ShoppingCart size={14} className="text-amber-400" />;
    default: return <Minus size={14} className="text-slate-400" />;
  }
}

function txColor(sign: "in" | "out" | "neutral", type?: TxType) {
  if (sign === "in") return "text-emerald-400";
  if (sign === "neutral") return "text-slate-400";
  if (type === "expense") return "text-amber-400";
  if (type === "fixed") return "text-orange-400";
  return "text-red-400";
}

function txLabel(type: TxType) {
  switch (type) {
    case "expense": return "Dépense";
    case "income": return "Revenu";
    case "fixed": return "Charge fixe";
    case "loan": return "Prêt";
    case "saving": return "Épargne";
    case "project": return "Projet";
    case "planned": return "Planifiée";
    case "wish": return "Envie achetée";
    case "shopping": return "Course";
    default: return "";
  }
}

function monthsForPeriod(period: PeriodType, idx: number): number[] {
  switch (period) {
    case "month": return [idx];
    case "quarter": return [idx * 3, idx * 3 + 1, idx * 3 + 2];
    case "semester": return [idx * 6, idx * 6 + 1, idx * 6 + 2, idx * 6 + 3, idx * 6 + 4, idx * 6 + 5];
    case "year": return Array.from({ length: 12 }, (_, i) => i);
    default: return [];
  }
}

export default function HistoryView() {
  const { mutate: globalMutate } = useSWRConfig();
  const [year, setYear] = useState(new Date().getFullYear());
  const [period, setPeriod] = useState<PeriodType>("month");
  const [periodIndex, setPeriodIndex] = useState(new Date().getMonth());
  const [dayDate, setDayDate] = useState(new Date().toISOString().split("T")[0]);
  const [txFilter, setTxFilter] = useState<TxType>("all");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const range = useMemo(
    () => getDateRange(period, year, periodIndex, dayDate),
    [period, year, periodIndex, dayDate]
  );

  const historyKey = `/api/history?start=${range.start}&end=${range.end}&year=${year}`;
  const { data, isLoading: loading } = useSWR(
    historyKey,
    fetcher,
    { revalidateOnFocus: true }
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await globalMutate(historyKey);
    } finally {
      setRefreshing(false);
    }
  }, [globalMutate, historyKey]);

  const expenses: Expense[] = data?.expenses ?? [];
  const incomes: Income[] = data?.incomes ?? [];
  const fixedPayments: FixedChargePayment[] = data?.fixedPayments ?? [];
  const loanPayments: LoanPayment[] = data?.loanPayments ?? [];
  const loans: Loan[] = data?.loans ?? [];
  const savings: number[] = data?.savings ?? [];
  const salaries: number[] = data?.salaries ?? [];
  const otherIncomes: number[] = data?.otherIncomes ?? [];
  const projects: Project[] = data?.projects ?? [];
  const plannedExpenses: PlannedExpense[] = data?.plannedExpenses ?? [];
  const purchasedWishItems: WishListItem[] = data?.purchasedWishItems ?? [];
  const purchasedShoppingItems: ShoppingListItem[] = data?.purchasedShoppingItems ?? [];

  const loansById = useMemo(() => {
    const map: Record<number, Loan> = {};
    loans.forEach((l) => { map[l.id] = l; });
    return map;
  }, [loans]);

  const relevantMonths = useMemo(() => monthsForPeriod(period, periodIndex), [period, periodIndex]);

  const allTx: UnifiedTx[] = useMemo(() => {
    const items: UnifiedTx[] = [];

    expenses.forEach((e) => items.push({
      id: `exp-${e.id}`, date: e.date, time: e.time,
      description: e.description, amount: e.amount + (e.transaction_fee ?? 0),
      type: "expense", detail: e.category, sign: "out",
    }));

    incomes.forEach((i) => items.push({
      id: `inc-${i.id}`, date: i.date, time: i.time,
      description: i.description, amount: i.amount,
      type: "income", detail: i.source, sign: "in",
    }));

    fixedPayments.forEach((f) => items.push({
      id: `fix-${f.id}`, date: f.date, time: f.time,
      description: f.label, amount: f.amount,
      type: "fixed", detail: f.notes, sign: "out",
    }));

    loanPayments.forEach((lp) => {
      const loan = loansById[lp.loan_id];
      if (!loan) return;
      const isLent = loan.type === "personal_lent";
      items.push({
        id: `lp-${lp.id}`, date: lp.date, time: lp.time,
        description: `${isLent ? "Remb. reçu" : "Remb."} — ${loan.label || "Prêt"}`,
        amount: lp.amount + lp.fees,
        type: "loan", detail: loan.lender_borrower,
        sign: isLent ? "in" : "out",
      });
    });

    if (period !== "day") {
      relevantMonths.forEach((m) => {
        const savAmt = savings[m] || 0;
        if (savAmt > 0) {
          const dateStr = `${year}-${String(m + 1).padStart(2, "0")}-01`;
          items.push({
            id: `sav-${m}`, date: dateStr, time: "00:00",
            description: `Épargne ${MONTHS_SHORT[m]}`,
            amount: savAmt, type: "saving", sign: "out",
          });
        }
        const salAmt = salaries[m] || 0;
        if (salAmt > 0) {
          const hasSyncedSalaryIncome = incomes.some((i) => {
            if (i.source !== INCOME_SOURCE_SALARY_SETTINGS) return false;
            const parts = i.date.split("-").map(Number);
            return parts[0] === year && parts[1] === m + 1;
          });
          if (!hasSyncedSalaryIncome) {
            const dateStr = `${year}-${String(m + 1).padStart(2, "0")}-01`;
            items.push({
              id: `sal-${m}`, date: dateStr, time: "00:00",
              description: `Salaire net ${MONTHS_SHORT[m]}`,
              amount: salAmt, type: "income", detail: "salaire", sign: "in",
            });
          }
        }
        const othAmt = otherIncomes[m] || 0;
        if (othAmt > 0) {
          const dateStr = `${year}-${String(m + 1).padStart(2, "0")}-01`;
          items.push({
            id: `oth-${m}`, date: dateStr, time: "00:00",
            description: `Autres revenus ${MONTHS_SHORT[m]}`,
            amount: othAmt, type: "income", detail: "autres", sign: "in",
          });
        }
      });
    }

    loans.forEach((l) => {
      if (l.start_date >= range.start && l.start_date <= range.end) {
        if (l.type === "personal_lent") {
          items.push({
            id: `loan-out-${l.id}`, date: l.start_date, time: "00:00",
            description: `Prêt accordé — ${l.label}`,
            amount: l.total_amount, type: "loan",
            detail: l.lender_borrower, sign: "out",
          });
        } else {
          items.push({
            id: `loan-in-${l.id}`, date: l.start_date, time: "00:00",
            description: `Emprunt reçu — ${l.label}`,
            amount: l.total_amount, type: "loan",
            detail: l.lender_borrower, sign: "in",
          });
        }
      }
    });

    projects.forEach((p) => {
      if (p.saved_amount > 0 && p.created_at) {
        const createdDate = p.created_at.split("T")[0] || p.created_at.split(" ")[0];
        if (createdDate >= range.start && createdDate <= range.end) {
          items.push({
            id: `proj-${p.id}`, date: createdDate, time: "00:00",
            description: `Projet — ${p.name}`,
            amount: p.saved_amount, type: "project",
            detail: `${formatCFA(p.saved_amount)} / ${formatCFA(p.target_amount)}`, sign: "out",
          });
        }
      }
    });

    plannedExpenses
      .filter((pe) => pe.status !== "cancelled")
      .forEach((pe) => {
        if (pe.due_date >= range.start && pe.due_date <= range.end) {
          items.push({
            id: `plan-${pe.id}`, date: pe.due_date, time: "00:00",
            description: `[${pe.status === "executed" ? "Exécutée" : "En attente"}] ${pe.description}`,
            amount: pe.amount, type: "planned",
            detail: pe.category, sign: pe.status === "executed" ? "out" : "neutral",
          });
        }
      });

    purchasedWishItems.forEach((w) => {
      const dateTime = w.purchased_at ? w.purchased_at.split("T") : [w.target_date, "00:00"];
      const date = dateTime[0] || w.target_date;
      const time = dateTime[1]?.slice(0, 5) || "00:00";
      items.push({
        id: `wish-${w.id}`,
        date,
        time,
        description: `Envie achetée — ${w.name}`,
        amount: w.actual_amount ?? w.estimated_amount,
        type: "wish",
        detail: w.category,
        sign: "out",
      });
    });

    purchasedShoppingItems.forEach((s) => {
      const dateTime = s.purchased_at ? s.purchased_at.split("T") : [range.start, "00:00"];
      const date = dateTime[0] || range.start;
      const time = dateTime[1]?.slice(0, 5) || "00:00";
      items.push({
        id: `shop-${s.id}`,
        date,
        time,
        description: `Course — ${s.name}`,
        amount: s.actual_amount ?? s.estimated_amount,
        type: "shopping",
        detail: s.category,
        sign: "out",
      });
    });

    items.sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      return cmp !== 0 ? cmp : b.time.localeCompare(a.time);
    });
    return items;
  }, [expenses, incomes, fixedPayments, loanPayments, loansById, savings, salaries, otherIncomes, loans, projects, plannedExpenses, purchasedWishItems, purchasedShoppingItems, period, relevantMonths, year, range.start, range.end]);

  const filteredTx = useMemo(
    () => txFilter === "all" ? allTx : allTx.filter((t) => t.type === txFilter),
    [allTx, txFilter]
  );

  const groupedByDate = useMemo(() => {
    const map: Record<string, UnifiedTx[]> = {};
    filteredTx.forEach((t) => { (map[t.date] ||= []).push(t); });
    Object.values(map).forEach((arr) => arr.sort((a, b) => (b.time || "00:00").localeCompare(a.time || "00:00")));
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredTx]);

  const totalIn = useMemo(() => filteredTx.filter((t) => t.sign === "in").reduce((s, t) => s + t.amount, 0), [filteredTx]);
  const totalOut = useMemo(() => filteredTx.filter((t) => t.sign === "out").reduce((s, t) => s + t.amount, 0), [filteredTx]);
  const balance = totalIn - totalOut;

  const savingsTotal = useMemo(() => {
    if (period === "day") return 0;
    return relevantMonths.reduce((s, m) => s + (savings[m] || 0), 0);
  }, [savings, period, relevantMonths]);

  const projectsTotal = useMemo(() => projects.reduce((s, p) => s + p.saved_amount, 0), [projects]);

  const savingsRate = totalIn > 0 ? (savingsTotal / totalIn) * 100 : 0;

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
    if (period === "day") { const d = new Date(dayDate); d.setDate(d.getDate() - 1); setDayDate(d.toISOString().split("T")[0]); }
    else if (periodIndex > 0) setPeriodIndex(periodIndex - 1);
  };
  const navigateNext = () => {
    if (period === "day") { const d = new Date(dayDate); d.setDate(d.getDate() + 1); setDayDate(d.toISOString().split("T")[0]); }
    else if (periodIndex < maxIndex) setPeriodIndex(periodIndex + 1);
  };

  const txCounts = useMemo(() => {
    const counts: Record<TxType, number> = { all: allTx.length, expense: 0, income: 0, fixed: 0, loan: 0, saving: 0, project: 0, planned: 0, wish: 0, shopping: 0 };
    allTx.forEach((t) => { if (t.type !== "all") counts[t.type]++; });
    return counts;
  }, [allTx]);

  const wishTotal = useMemo(
    () => purchasedWishItems.reduce((s, w) => s + (w.actual_amount ?? w.estimated_amount), 0),
    [purchasedWishItems]
  );
  const shoppingTotal = useMemo(
    () => purchasedShoppingItems.reduce((s, s2) => s + (s2.actual_amount ?? s2.estimated_amount), 0),
    [purchasedShoppingItems]
  );

  return (
    <div className="animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-5 lg:mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
            <History size={22} className="text-emerald-400" /> Suivi des KPIs
          </h1>
          <p className="text-slate-500 text-xs lg:text-sm mt-0.5">{range.label} — Transactions et indicateurs</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-emerald-400 transition-colors disabled:opacity-50"
            title="Actualiser"
          >
            <RefreshCw size={16} className={refreshing || loading ? "animate-spin" : ""} />
          </button>
          <select className="input-field w-24" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {getSelectableYears().map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={() => exportHistoryCSV(filteredTx, range.label, totalIn, totalOut, balance)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold transition-colors"
            title="Exporter en CSV/Excel"
          >
            <FileSpreadsheet size={14} />
            CSV
          </button>
          <button
            onClick={async () => {
              setExportingPdf(true);
              try {
                await exportHistoryPDF(filteredTx, range.label, totalIn, totalOut, balance);
              } catch { /* ignore */ }
              setExportingPdf(false);
            }}
            disabled={exportingPdf || filteredTx.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold transition-colors disabled:opacity-50"
            title="Exporter en PDF"
          >
            <FileDown size={14} />
            {exportingPdf ? "..." : "PDF"}
          </button>
        </div>
      </div>

      {/* Sélecteur de période */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(Object.keys(PERIOD_LABELS) as PeriodType[]).map((p) => (
          <button key={p} onClick={() => handlePeriodChange(p)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              period === p ? "bg-emerald-500/30 text-emerald-300 ring-1 ring-emerald-500/50" : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}>{PERIOD_LABELS[p]}</button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between glass-strong rounded-xl p-3 mb-4">
        <button onClick={navigatePrev} disabled={!canPrev}
          className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 disabled:opacity-30 transition-colors"><ChevronLeft size={18} /></button>
        <div className="text-center">
          {period === "day" ? (
            <input type="date" className="input-field text-xs text-center" value={dayDate} onChange={(e) => setDayDate(e.target.value)} />
          ) : (
            <span className="text-sm font-semibold text-slate-200">{range.label}</span>
          )}
        </div>
        <button onClick={navigateNext} disabled={!canNext}
          className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 disabled:opacity-30 transition-colors"><ChevronRight size={18} /></button>
      </div>

      {/* KPIs — Indicateurs clés de la période */}
      <div className="glass-strong rounded-2xl p-4 lg:p-5 mb-5 border border-emerald-500/20">
        <div className="text-[11px] font-semibold text-emerald-400/90 mb-3 flex items-center gap-1.5">
          <TrendingUp size={14} /> Indicateurs de la période
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
          <div className="glass rounded-xl p-3 text-center">
            <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1"><TrendingUp size={10} /> Entrées</div>
            <div className="font-mono text-sm font-bold text-emerald-400 mt-0.5">{formatCFA(totalIn)}</div>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1"><TrendingDown size={10} /> Sorties</div>
            <div className="font-mono text-sm font-bold text-red-400 mt-0.5">{formatCFA(totalOut)}</div>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1"><Banknote size={10} /> Solde</div>
            <div className={`font-mono text-sm font-bold mt-0.5 ${balance >= 0 ? "text-emerald-400" : "text-red-400"}`}>{balance >= 0 ? "+" : "-"}{formatCFA(Math.abs(balance))}</div>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1"><PiggyBank size={10} /> Épargne</div>
            <div className="font-mono text-sm font-bold text-amber-400 mt-0.5">{formatCFA(savingsTotal)}</div>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1">Taux épargne</div>
            <div className={`font-mono text-sm font-bold mt-0.5 ${savingsRate >= 20 ? "text-emerald-400" : savingsRate >= 10 ? "text-amber-400" : "text-slate-400"}`}>{savingsRate.toFixed(1)}%</div>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1"><FolderOpen size={10} /> Projets</div>
            <div className="font-mono text-sm font-bold text-emerald-400 mt-0.5">{formatCFA(projectsTotal)}</div>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1"><Heart size={10} /> Envies</div>
            <div className="font-mono text-sm font-bold text-pink-400 mt-0.5">{formatCFA(wishTotal)}</div>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1"><ShoppingCart size={10} /> Courses</div>
            <div className="font-mono text-sm font-bold text-amber-400 mt-0.5">{formatCFA(shoppingTotal)}</div>
          </div>
        </div>
      </div>

      {/* Filtre par type */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
        <Filter size={14} className="text-slate-500 shrink-0" />
        {TX_FILTERS.map(({ key, label }) => (
          <button key={key} onClick={() => setTxFilter(key)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
              txFilter === key ? "bg-white/10 text-slate-200 ring-1 ring-white/20" : "bg-white/[0.03] text-slate-500 hover:text-slate-400"
            }`}>
            {label}
            {txCounts[key] > 0 && <span className="text-[8px] opacity-60">({txCounts[key]})</span>}
          </button>
        ))}
      </div>

      {/* Liste des transactions */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Chargement...</div>
      ) : filteredTx.length === 0 ? (
        <div className="glass-strong rounded-2xl py-12 text-center text-slate-500">
          <Calendar size={36} className="mx-auto mb-3 text-slate-600" />
          <p className="text-sm">Aucune transaction sur cette période</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedByDate.map(([date, items]) => {
            const dayIn = items.filter((t) => t.sign === "in").reduce((s, t) => s + t.amount, 0);
            const dayOut = items.filter((t) => t.sign === "out").reduce((s, t) => s + t.amount, 0);
            return (
              <div key={date} className="glass-strong rounded-xl overflow-hidden">
                <div className="flex justify-between items-center px-4 py-2.5 bg-white/[0.03] border-b border-white/5">
                  <span className="text-[11px] font-semibold text-slate-400">
                    {new Date(date).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short", year: period !== "month" && period !== "day" ? "numeric" : undefined })}
                  </span>
                  <div className="flex gap-3 text-[10px] font-mono">
                    {dayIn > 0 && <span className="text-emerald-400">+{formatCFA(dayIn)}</span>}
                    {dayOut > 0 && <span className="text-red-400">-{formatCFA(dayOut)}</span>}
                  </div>
                </div>
                {items.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.02] last:border-0">
                    <span className="shrink-0">{txIcon(tx.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs truncate">{tx.description}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[9px] text-slate-500">{txLabel(tx.type)}</span>
                        {tx.time && tx.time !== "00:00" && <span className="text-[9px] text-slate-600">{tx.time}</span>}
                        {tx.detail && <span className="text-[9px] text-slate-600 truncate max-w-[120px]">· {tx.detail}</span>}
                      </div>
                    </div>
                    <span className={`font-mono text-xs font-semibold shrink-0 ${txColor(tx.sign, tx.type)}`}>
                      {tx.sign === "in" ? "+" : tx.sign === "out" ? "-" : ""}{formatCFA(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div className="text-center text-[10px] text-slate-500 pt-3 pb-16 lg:pb-3">
        {filteredTx.length} transaction{filteredTx.length > 1 ? "s" : ""} · {groupedByDate.length} jour{groupedByDate.length > 1 ? "s" : ""}
      </div>
    </div>
  );
}
