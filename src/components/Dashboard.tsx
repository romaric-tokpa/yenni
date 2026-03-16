"use client";
import { useState } from "react";
import { formatCFA, MONTHS_FULL } from "@/lib/constants";
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
  totalSaved: number;
  totalProjectSaved: number;
  monthSalary: number;
  monthSaving: number;
  totalMonthSpent: number;
  totalBudgetVar: number;
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
  if (level === "good") return <CircleCheck size={16} className="text-emerald-400" />;
  if (level === "warn") return <CircleAlert size={16} className="text-amber-400" />;
  return <CircleMinus size={16} className="text-red-400" />;
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
    totalSaved,
    totalProjectSaved,
    monthSalary,
    monthSaving,
    totalMonthSpent,
    totalBudgetVar,
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
      color: "text-emerald-400",
      shadow: "shadow-emerald-500/10",
      IconComp: TrendingUp,
      iconColor: "text-emerald-400",
    },
    {
      label: "Passifs (Sorties)",
      value: formatCFA(totalExpenses),
      sub: `Fixes ${formatCFA(totalFixed)} + Dép. ${formatCFA(totalMonthSpent)}${monthLoanRepayments > 0 ? ` + Remb. ${formatCFA(monthLoanRepayments)}` : ""} + Ép. ${formatCFA(monthSaving)}`,
      color: "text-red-400",
      shadow: "shadow-red-500/10",
      IconComp: TrendingDown,
      iconColor: "text-red-400",
    },
    {
      label: "Solde Disponible",
      value: formatCFA(Math.abs(soldeNet)),
      sub: soldeNet >= 0 ? `${formatCFA(dailyBudget)} / jour restant` : "Solde négatif",
      color: soldeNet >= 0 ? "text-emerald-400" : "text-red-400",
      shadow: soldeNet >= 0 ? "shadow-emerald-500/10" : "shadow-red-500/10",
      IconComp: soldeNet >= 0 ? Wallet : Scale,
      iconColor: soldeNet >= 0 ? "text-emerald-400" : "text-red-400",
      prefix: soldeNet < 0 ? "-" : "",
    },
    {
      label: "Épargne Cumulée",
      value: formatCFA(totalSaved),
      sub: `${config.savingsGoal > 0 ? ((totalSaved / config.savingsGoal) * 100).toFixed(1) : 0}% objectif${totalProjectSaved > 0 ? ` · Projets ${formatCFA(totalProjectSaved)}` : ""}`,
      color: "text-amber-400",
      shadow: "shadow-amber-500/10",
      IconComp: Trophy,
      iconColor: "text-amber-400",
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

  return (
    <div className="animate-slide-up">
      <div className="flex flex-col gap-3 mb-5 lg:mb-7">
        {/* Ligne supérieure : titre + profil utilisateur */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-100">Tableau de bord</h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              {MONTHS_FULL[selectedMonth]} {selectedYear} — Vue d&apos;ensemble
            </p>
          </div>
          {user && (
            <div className="flex items-center gap-2.5">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-200 leading-tight">{user.first_name} {user.last_name}</p>
                <p className="text-[10px] text-slate-500">Bienvenue !</p>
              </div>
              <Avatar avatarPath={user.avatar_path} firstName={user.first_name} lastName={user.last_name} size="lg" />
            </div>
          )}
        </div>
        {/* Sélecteurs mois / année + Export */}
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
            onClick={handleExportPDF}
            disabled={exportingPdf}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold transition-colors"
            title="Exporter le bilan en PDF"
          >
            <FileDown size={14} />
            {exportingPdf ? "Export..." : "PDF"}
          </button>
        </div>
      </div>

      {/* Saisie du salaire net du mois */}
      <div className={`glass-strong rounded-2xl p-3 lg:p-4 mb-5 lg:mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 ${monthSalary === 0 ? "ring-1 ring-amber-500/30" : ""}`}>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Banknote size={18} className={monthSalary > 0 ? "text-emerald-400" : "text-amber-400"} />
          <span className="text-xs lg:text-sm font-semibold text-slate-300">
            {monthSalary > 0 ? "Salaire net perçu" : "Salaire non renseigné"}
          </span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
          <input
            type="number"
            className="input-field font-mono text-sm lg:text-base flex-1 sm:w-48"
            placeholder="Saisir le salaire du mois"
            defaultValue={monthSalary || ""}
            key={`sal-${selectedMonth}`}
            onChange={(e) => updateSalary(selectedMonth, Number(e.target.value) || 0)}
          />
          <span className="text-[10px] lg:text-xs text-slate-500 flex-shrink-0">FCFA</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-5 lg:mb-6">
        {kpis.map((k, i) => (
          <div
            key={i}
            className={`glass kpi-card rounded-2xl p-4 lg:p-5 ${k.shadow} shadow-lg`}
          >
            <div className="flex justify-between items-center mb-2 lg:mb-3">
              <span className="text-[10px] lg:text-xs text-slate-400 font-medium">
                {k.label}
              </span>
              <k.IconComp size={20} className={k.iconColor} />
            </div>
            <div className={`font-mono text-lg lg:text-2xl font-bold ${k.color}`}>
              {k.value}
            </div>
            <div className="text-[10px] lg:text-[11px] text-slate-500 mt-0.5 lg:mt-1">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-3 mb-5 lg:mb-7">
        {miniKpis.map((k, i) => (
          <div
            key={i}
            className="glass rounded-xl p-3 lg:p-4 flex justify-between items-center"
          >
            <div className="min-w-0">
              <div className="text-[9px] lg:text-[11px] text-slate-500 truncate">{k.label}</div>
              <div className="font-mono text-xs lg:text-base font-bold mt-0.5">
                {k.value}
              </div>
            </div>
            <span className="ml-1 shrink-0">
              <StatusDot level={k.level} />
            </span>
          </div>
        ))}
      </div>

      <div className="glass-strong rounded-2xl p-4 lg:p-6 mb-5 lg:mb-6">
        <h3 className="text-sm lg:text-base font-semibold mb-4 lg:mb-5 text-slate-100 flex items-center gap-2">
          <FolderOpen size={16} className="text-emerald-400" /> Budget par Catégorie
        </h3>
        <div className="grid gap-3 lg:gap-3.5">
          {config.categories.map((cat: Category) => {
            const spent = catSpending[cat.id] || 0;
            const pct = cat.budget > 0 ? Math.min((spent / cat.budget) * 100, 150) : 0;
            const isOver = spent > cat.budget;
            return (
              <div key={cat.id}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs lg:text-[13px] flex items-center gap-1.5">
                    <Icon name={cat.icon} size={14} style={{ color: cat.color }} />
                    {cat.label}
                  </span>
                  <div className="flex items-center gap-2 lg:gap-3">
                    <span className={`font-mono text-[10px] lg:text-xs ${isOver ? "text-red-400" : "text-slate-400"}`}>
                      {formatCFA(spent)} / {formatCFA(cat.budget)}
                    </span>
                    <StatusDot level={isOver ? "bad" : pct > 80 ? "warn" : "good"} />
                  </div>
                </div>
                <AnimatedProgressBar
                  value={spent}
                  max={cat.budget}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-5 lg:mb-6">
        <div className="glass-strong rounded-2xl p-4 lg:p-6">
          <h3 className="text-xs lg:text-sm font-semibold mb-3 lg:mb-4 text-slate-300 flex items-center gap-2">
            <PieChart size={14} className="text-emerald-400" /> Répartition du Budget
          </h3>
          <BudgetPieChart categories={config.categories} />
        </div>
        <div className="glass-strong rounded-2xl p-4 lg:p-6">
          <h3 className="text-xs lg:text-sm font-semibold mb-3 lg:mb-4 text-slate-300 flex items-center gap-2">
            <BarChart3 size={14} className="text-emerald-400" /> Revenus vs Dépenses
          </h3>
          <MonthlyBarChart
            totalIncome={totalIncome}
            totalFixed={totalFixed}
            totalVariable={totalMonthSpent}
          />
        </div>
      </div>

      <div className="glass-strong rounded-2xl p-4 lg:p-6">
        <h3 className="text-sm lg:text-base font-semibold mb-3 lg:mb-4 text-slate-100 flex items-center gap-2">
          <ClipboardList size={16} className="text-emerald-400" /> Détail des Charges Fixes
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-2.5">
          {config.fixedCharges.map((ch: FixedCharge) => (
            <div
              key={ch.id}
              className="flex justify-between items-center px-3 lg:px-4 py-2.5 lg:py-3 bg-white/[0.02] rounded-xl border border-white/5"
            >
              <span className="text-xs lg:text-[13px] flex items-center gap-1.5">
                <Icon name={ch.icon} size={14} className="text-slate-400" />
                {ch.label}
              </span>
              <span className="font-mono text-xs lg:text-[13px] text-red-300 font-semibold">
                {formatCFA(ch.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
