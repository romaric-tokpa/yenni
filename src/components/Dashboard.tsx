"use client";
import { useState, useEffect } from "react";
import { formatCFA, MONTHS_FULL, getSelectableYears } from "@/lib/constants";
import Avatar from "./ui/Avatar";
import { BudgetConfig, Category, FixedCharge } from "@/lib/types";
import MonthlyBarChart from "./charts/MonthlyBarChart";
import BudgetPieChart from "./charts/BudgetPieChart";
import Icon from "./ui/Icon";
import AnimatedProgressBar from "./ui/AnimatedProgressBar";
import {
  TrendingUp, TrendingDown, Wallet, Trophy, Scale, Banknote, HandCoins,
  FolderOpen, PieChart, BarChart3, ClipboardList,
  CircleCheck, CircleAlert, CircleMinus, FileDown,
} from "lucide-react";
import { exportBilanPDFFromData } from "@/lib/exportUtils";

interface AuthUser {
  first_name: string;
  last_name: string;
  avatar_path: string | null;
}

interface BudgetData {
  config: BudgetConfig;
  totalIncome: number;
  totalFixed: number;
  totalExpenses: number;
  soldeNet: number;
  resteAVivre: number;
  dailyBudget: number;
  daysLeftInMonth: number;
  totalSaved: number;
  totalProjectSaved: number;
  monthSalary: number;
  monthSaving: number;
  totalMonthSpent: number;
  totalBudgetVar: number;
  effectiveCategoryBudgets?: Record<string, number>;
  monthLoanPayments: number;
  monthLoanRepayments: number;
  monthLoanRecovered: number;
  totalDebt: number;
  catSpending: Record<string, number>;
  selectedMonth: number;
  selectedYear: number;
  setSelectedMonth: (m: number) => void;
  setSelectedYear: (y: number) => void;
  updateSalary: (month: number, amount: number) => Promise<void>;
}

function StatusDot({ level }: { level: "good" | "warn" | "bad" }) {
  if (level === "good") return <CircleCheck size={14} className="text-green-500" />;
  if (level === "warn") return <CircleAlert size={14} className="text-amber-500" />;
  return <CircleMinus size={14} className="text-red-500" />;
}

export default function Dashboard({ budget, user }: { budget: BudgetData; user?: AuthUser | null }) {
  const {
    config,
    totalIncome,
    totalFixed,
    totalExpenses,
    soldeNet,
    resteAVivre,
    dailyBudget,
    daysLeftInMonth,
    totalSaved,
    totalProjectSaved,
    monthSalary,
    monthSaving,
    totalMonthSpent,
    totalBudgetVar,
    effectiveCategoryBudgets = {},
    monthLoanPayments,
    monthLoanRepayments,
    monthLoanRecovered,
    totalDebt,
    catSpending,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    updateSalary,
  } = budget;

  const [exportingPdf, setExportingPdf] = useState(false);
  const [monthlyChartData, setMonthlyChartData] = useState<Array<{ month: number; Revenus: number; Dépenses: number }> | null>(null);

  useEffect(() => {
    fetch(`/api/budget-summary?year=${selectedYear}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setMonthlyChartData(Array.isArray(d) && d.length === 12 ? d : null))
      .catch(() => setMonthlyChartData(null));
  }, [selectedYear]);

  const chargesRate = totalIncome > 0 ? (totalFixed / totalIncome) * 100 : 0;
  const realMonthlySavings = monthSaving + totalProjectSaved;
  const savingsRate = totalIncome > 0 ? (realMonthlySavings / totalIncome) * 100 : 0;
  const debtRatio = totalIncome > 0 ? (monthLoanRepayments / totalIncome) * 100 : 0;

  const handleExportPDF = async () => {
    setExportingPdf(true);
    try {
      await exportBilanPDFFromData({
        month: selectedMonth,
        year: selectedYear,
        totalIncome,
        totalFixed,
        totalMonthSpent,
        monthSaving,
        monthLoanRepayments,
        totalExpenses,
        soldeNet,
        dailyBudget,
        totalSaved,
        totalProjectSaved,
        catSpending,
        categories: config.categories,
        effectiveBudgets: effectiveCategoryBudgets,
      });
    } catch {
      // silent fail
    }
    setExportingPdf(false);
  };

  const kpis = [
    {
      label: "Actifs (Revenus)",
      value: formatCFA(totalIncome),
      sub: "Total entrées du mois",
      color: "text-green-500",
      shadow: "",
      IconComp: TrendingUp,
      iconColor: "text-green-500",
    },
    {
      label: "Passifs (Sorties)",
      value: formatCFA(totalExpenses),
      sub: `Fixes ${formatCFA(totalFixed)} + Dép. ${formatCFA(totalMonthSpent)}${monthLoanRepayments > 0 ? ` + Remb. ${formatCFA(monthLoanRepayments)}` : ""} + Ép. ${formatCFA(monthSaving)}`,
      color: "text-red-500",
      shadow: "",
      IconComp: TrendingDown,
      iconColor: "text-red-500",
    },
    {
      label: "Solde Disponible",
      value: formatCFA(Math.abs(soldeNet)),
      sub: soldeNet >= 0 ? `${formatCFA(dailyBudget)} / jour · ${daysLeftInMonth} jour${daysLeftInMonth > 1 ? "s" : ""} restant${daysLeftInMonth > 1 ? "s" : ""}` : "Solde négatif",
      color: soldeNet >= 0 ? "text-green-500" : "text-red-500",
      shadow: "",
      IconComp: soldeNet >= 0 ? Wallet : Scale,
      iconColor: soldeNet >= 0 ? "text-green-500" : "text-red-500",
      prefix: soldeNet < 0 ? "-" : "",
    },
    {
      label: "Épargne Cumulée",
      value: formatCFA(totalSaved),
      sub: `${config.savingsGoal > 0 ? ((totalSaved / config.savingsGoal) * 100).toFixed(1) : 0}% objectif${totalProjectSaved > 0 ? ` · Projets ${formatCFA(totalProjectSaved)}` : ""}`,
      color: "text-amber-500",
      shadow: "",
      IconComp: Trophy,
      iconColor: "text-amber-500",
    },
  ];

  const miniKpis = [
    {
      label: "Taux d'endettement",
      value: `${debtRatio.toFixed(1)}%`,
      level: (debtRatio < 33 ? "good" : debtRatio < 50 ? "warn" : "bad") as "good" | "warn" | "bad",
    },
    {
      label: "Taux d'épargne",
      value: `${savingsRate.toFixed(1)}%`,
      level: (savingsRate >= 20 ? "good" : savingsRate >= 10 ? "warn" : "bad") as "good" | "warn" | "bad",
    },
    {
      label: "Dépensé ce mois",
      value: `${formatCFA(totalMonthSpent)} FCFA`,
      level: (totalMonthSpent <= totalBudgetVar ? "good" : "bad") as "good" | "bad",
    },
    {
      label: "Solde net",
      value: `${soldeNet >= 0 ? "+" : "-"}${formatCFA(Math.abs(soldeNet))}`,
      level: (soldeNet > 0 ? "good" : soldeNet === 0 ? "warn" : "bad") as "good" | "warn" | "bad",
    },
    {
      label: "Dette restante",
      value: `${formatCFA(totalDebt)} FCFA`,
      level: (totalDebt === 0 ? "good" : totalDebt < 1000000 ? "warn" : "bad") as "good" | "warn" | "bad",
    },
  ];

  const greeting = user ? `Bonjour, ${user.first_name}` : "Tableau de bord";

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {user && (
            <Avatar
              avatarPath={user.avatar_path}
              firstName={user.first_name}
              lastName={user.last_name}
              size="lg"
              className="shrink-0"
            />
          )}
          <div>
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight">{greeting}</h1>
            <p className="text-neutral-500 text-xs lg:text-sm mt-0.5">
              {MONTHS_FULL[selectedMonth]} {selectedYear}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select className="input-field w-32 text-sm py-2" value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
            {MONTHS_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select className="input-field w-24 text-sm py-2" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
            {getSelectableYears().map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={handleExportPDF}
            disabled={exportingPdf}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-neutral-400 hover:text-white text-xs font-medium transition-colors"
          >
            <FileDown size={14} />
            {exportingPdf ? "..." : "PDF"}
          </button>
        </div>
      </div>

      {/* Salaire */}
      <div className={`rounded-xl border p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 ${monthSalary === 0 ? "border-amber-500/40 bg-amber-500/5" : "border-white/5 bg-white/[0.02]"}`}>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Banknote size={18} className={monthSalary > 0 ? "text-emerald-400" : "text-amber-400"} />
          <span className="text-sm font-medium text-neutral-300">{monthSalary > 0 ? "Salaire du mois" : "Salaire non renseigné"}</span>
        </div>
        <input
          type="number"
          className="input-field font-mono text-sm flex-1 sm:w-44"
          placeholder="0 FCFA"
          defaultValue={monthSalary || ""}
          key={`sal-${selectedMonth}`}
          onChange={(e) => updateSalary(selectedMonth, Number(e.target.value) || 0)}
        />
      </div>

      {/* KPIs principaux */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <div key={i} className="flex items-start gap-3">
            <k.IconComp size={20} className={`shrink-0 mt-0.5 ${k.iconColor}`} />
            <div className="min-w-0">
              <div className="text-[10px] text-neutral-500">{k.label}</div>
              <div className={`font-mono text-base lg:text-lg font-bold mt-0.5 ${k.color}`}>{k.prefix ?? ""}{k.value}</div>
              <div className="text-[10px] text-neutral-500 mt-0.5 line-clamp-2">{k.sub}</div>
            </div>
          </div>
        ))}
        </div>
      </div>

      {/* Mini KPIs */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {miniKpis.map((k, i) => (
          <div key={i} className="flex justify-between items-center py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="min-w-0">
              <div className="text-[10px] text-neutral-500 truncate">{k.label}</div>
              <div className="font-mono text-xs font-semibold mt-0.5 truncate">{k.value}</div>
            </div>
            <StatusDot level={k.level} />
          </div>
        ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 mb-6">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <FolderOpen size={14} className="text-emerald-400" /> Budget par catégorie
        </h3>
        <div className="grid gap-3 lg:gap-3.5">
          {config.categories.map((cat: Category) => {
            const budget = effectiveCategoryBudgets[cat.id] ?? cat.budget;
            const spent = catSpending[cat.id] || 0;
            const pct = budget > 0 ? Math.min((spent / budget) * 100, 150) : 0;
            const isOver = spent > budget;
            return (
              <div key={cat.id}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs lg:text-[13px] flex items-center gap-1.5">
                    <Icon name={cat.icon} size={14} style={{ color: cat.color }} />
                    {cat.label}
                  </span>
                  <div className="flex items-center gap-2 lg:gap-3">
                    <span className={`font-mono text-[10px] lg:text-xs ${isOver ? "text-red-400" : "text-neutral-400"}`}>
                      {formatCFA(spent)} / {formatCFA(budget)}
                    </span>
                    <StatusDot level={isOver ? "bad" : pct > 80 ? "warn" : "good"} />
                  </div>
                </div>
                <AnimatedProgressBar
                  value={spent}
                  max={budget}
                  duration={0.6}
                  className="h-1.5 lg:h-2"
                  gradient={
                    isOver
                      ? "linear-gradient(90deg,#ef4444,#f87171)"
                      : pct > 80
                        ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
                        : `linear-gradient(90deg,${cat.color},${cat.color}dd)`
                  }
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <h3 className="text-xs font-semibold mb-2 text-neutral-400 flex items-center gap-1.5">
            <PieChart size={12} className="text-emerald-400" /> Répartition du budget
          </h3>
          <BudgetPieChart categories={config.categories} effectiveBudgets={effectiveCategoryBudgets} />
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <h3 className="text-xs font-semibold mb-2 text-neutral-400 flex items-center gap-1.5">
            <BarChart3 size={12} className="text-emerald-400" /> Revenus vs Dépenses
          </h3>
          <MonthlyBarChart
            monthlyData={monthlyChartData ?? undefined}
            totalIncome={totalIncome}
            totalFixed={totalFixed}
            totalVariable={totalMonthSpent}
            currentMonth={selectedMonth}
          />
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <ClipboardList size={14} className="text-emerald-400" /> Charges fixes
        </h3>
        {config.fixedCharges.length === 0 ? (
          <p className="text-neutral-500 text-xs py-4">Aucune charge fixe configurée</p>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-2.5">
          {config.fixedCharges.map((ch: FixedCharge) => (
            <div
              key={ch.id}
              className="flex justify-between items-center px-3 lg:px-4 py-2.5 lg:py-3 rounded-lg border border-white/5 bg-white/[0.02]"
            >
              <span className="text-xs lg:text-[13px] flex items-center gap-1.5">
                <Icon name={ch.icon} size={14} className="text-neutral-400" />
                {ch.label}
              </span>
              <span className="font-mono text-xs lg:text-[13px] text-red-300 font-semibold">
                {formatCFA(ch.amount)}
              </span>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
