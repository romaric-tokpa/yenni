"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatCFA, MONTHS_FULL, getSelectableYears } from "@/lib/constants";
import { BudgetConfig, Category, FixedCharge } from "@/lib/types";
import Icon from "./ui/Icon";
import AnimatedProgressBar from "./ui/AnimatedProgressBar";
import BudgetPieChart from "./charts/BudgetPieChart";
import MonthlyBarChart from "./charts/MonthlyBarChart";
import {
  CircleCheck,
  CircleAlert,
  CircleMinus,
  ChevronLeft,
  ChevronRight,
  Settings,
  FileDown,
  PieChart,
  BarChart3,
  FolderOpen,
  ClipboardList,
} from "lucide-react";
import { exportBilanPDFFromData } from "@/lib/exportUtils";

interface BudgetData {
  config: BudgetConfig;
  totalIncome: number;
  totalFixed: number;
  totalExpenses: number;
  soldeNet: number;
  totalBudgetVar: number;
  totalMonthSpent: number;
  monthSaving: number;
  catSpending: Record<string, number>;
  selectedMonth: number;
  selectedYear: number;
  setSelectedMonth: (m: number) => void;
  setSelectedYear: (y: number) => void;
  dailyBudget: number;
  totalSaved: number;
  totalProjectSaved: number;
  monthLoanRepayments: number;
  effectiveCategoryBudgets: Record<string, number>;
  updateCategoryBudget: (categoryId: string, amount: number) => Promise<boolean>;
}

function StatusDot({ level }: { level: "good" | "warn" | "bad" }) {
  if (level === "good") return <CircleCheck size={14} className="text-green-500" />;
  if (level === "warn") return <CircleAlert size={14} className="text-amber-500" />;
  return <CircleMinus size={14} className="text-red-500" />;
}

function CategoryBudgetCard({
  cat,
  budget,
  spent,
  pct,
  isOver,
  onSave,
}: {
  cat: Category;
  budget: number;
  spent: number;
  pct: number;
  isOver: boolean;
  onSave: (amount: number) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(budget));

  const handleBlur = async () => {
    setEditing(false);
    const n = parseInt(inputVal.replace(/\s/g, ""), 10);
    if (!Number.isNaN(n) && n >= 0) {
      await onSave(n);
    } else {
      setInputVal(String(budget));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="rounded-lg border border-white/5 p-3" style={{ borderLeft: `3px solid ${cat.color}` }}>
      <div className="flex justify-between mb-2 lg:mb-3">
        <span className="text-xs lg:text-[13px] font-medium flex items-center gap-1.5">
          <Icon name={cat.icon} size={14} style={{ color: cat.color }} />
          {cat.label}
        </span>
        <StatusDot level={isOver ? "bad" : pct > 80 ? "warn" : "good"} />
      </div>
      {editing ? (
        <input
          type="text"
          inputMode="numeric"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          className="font-mono text-base lg:text-lg font-bold w-full bg-white/5 border border-white/10 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500/50"
          style={{ color: cat.color }}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setInputVal(String(budget));
            setEditing(true);
          }}
          className="font-mono text-base lg:text-lg font-bold w-full text-left hover:bg-white/5 rounded px-1 -mx-1 py-0.5 transition-colors"
          style={{ color: cat.color }}
        >
          {formatCFA(budget)}
        </button>
      )}
      <div className="text-[10px] lg:text-[11px] text-slate-500 mt-0.5">
        Dépensé : {formatCFA(spent)} ({pct.toFixed(0)}%)
      </div>
      <AnimatedProgressBar
        value={spent}
        max={budget}
        duration={0.6}
        className="h-1.5 mt-2 lg:mt-3"
        gradient={
          isOver
            ? "linear-gradient(90deg,#ef4444,#f87171)"
            : pct > 80
              ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
              : `linear-gradient(90deg, ${cat.color}, ${cat.color}dd)`
        }
      />
    </div>
  );
}

export default function BudgetView({ budget }: { budget: BudgetData }) {
  const {
    config,
    totalIncome,
    totalFixed,
    totalExpenses,
    soldeNet,
    totalBudgetVar,
    totalMonthSpent,
    monthSaving,
    catSpending,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    dailyBudget,
    totalSaved,
    totalProjectSaved,
    monthLoanRepayments,
    effectiveCategoryBudgets,
    updateCategoryBudget,
  } = budget;

  const [exportingPdf, setExportingPdf] = useState(false);
  const [monthlyChartData, setMonthlyChartData] = useState<Array<{ month: number; Revenus: number; Dépenses: number }> | null>(null);
  const available = totalIncome - totalFixed - totalBudgetVar;

  useEffect(() => {
    fetch(`/api/budget-summary?year=${selectedYear}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setMonthlyChartData(Array.isArray(d) && d.length === 12 ? d : null))
      .catch(() => setMonthlyChartData(null));
  }, [selectedYear]);

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
      /* silent */
    }
    setExportingPdf(false);
  };

  return (
    <div className="animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-lg font-semibold text-neutral-100">Budget</h1>
          <p className="text-neutral-500 text-xs mt-0.5">{MONTHS_FULL[selectedMonth]} {selectedYear}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg bg-white/5 p-0.5">
            <button onClick={() => setSelectedMonth((selectedMonth - 1 + 12) % 12)} className="p-1.5 rounded text-neutral-500" aria-label="Mois précédent">
              <ChevronLeft size={16} />
            </button>
            <select
              className="input-field bg-transparent border-0 py-1.5 px-2 text-sm min-w-[100px]"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
              {MONTHS_FULL.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
            <button onClick={() => setSelectedMonth((selectedMonth + 1) % 12)} className="p-1.5 rounded text-neutral-500" aria-label="Mois suivant">
              <ChevronRight size={16} />
            </button>
          </div>
          <select
            className="input-field w-24"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {getSelectableYears().map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button onClick={handleExportPDF} disabled={exportingPdf} className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-white/5 text-neutral-400 text-xs">
            <FileDown size={12} />{exportingPdf ? "..." : "PDF"}
          </button>
          <Link href="/settings" prefetch={false} className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-white/5 text-neutral-400 text-xs">
            <Settings size={12} />Réglages
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-white/5 p-4 mb-4">
        <h3 className="text-xs font-medium mb-3 text-neutral-400 flex items-center gap-1.5">
          <PieChart size={12} className="text-green-500" /> Répartition
        </h3>
        {totalIncome > 0 ? (
          <>
            <div className="flex h-8 rounded-lg overflow-hidden mb-3">
              <div
                className="flex items-center justify-center text-[10px] lg:text-xs font-bold transition-all"
                style={{
                  width: `${Math.max(5, (totalFixed / totalIncome) * 100)}%`,
                  background: "linear-gradient(90deg,#ef4444,#f87171)",
                  minWidth: 40,
                }}
              >
                {((totalFixed / totalIncome) * 100).toFixed(0)}%
              </div>
              <div
                className="flex items-center justify-center text-[10px] lg:text-xs font-bold transition-all"
                style={{
                  width: `${Math.max(5, (totalBudgetVar / totalIncome) * 100)}%`,
                  background: "linear-gradient(90deg,#6366f1,#818cf8)",
                  minWidth: 40,
                }}
              >
                {((totalBudgetVar / totalIncome) * 100).toFixed(0)}%
              </div>
              <div
                className="flex-1 flex items-center justify-center text-[10px] lg:text-xs font-bold transition-all"
                style={{ background: "linear-gradient(90deg,#10b981,#34d399)", minWidth: 40 }}
              >
                {((available / totalIncome) * 100).toFixed(0)}%
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center text-[10px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                Fixes ({formatCFA(totalFixed)})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
                Variables ({formatCFA(totalBudgetVar)})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                Dispo ({formatCFA(available)})
              </span>
            </div>
          </>
        ) : (
          <div className="h-10 rounded-lg bg-white/4 flex items-center justify-center text-xs text-neutral-500">
            Renseigne ton salaire ci-dessus ou dans les réglages
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg border border-white/5 p-3">
          <h3 className="text-xs font-medium mb-2 text-neutral-400 flex items-center gap-1.5">
            <PieChart size={12} className="text-green-500" /> Répartition
          </h3>
          <BudgetPieChart categories={config.categories} effectiveBudgets={effectiveCategoryBudgets} />
        </div>
        <div className="rounded-lg border border-white/5 p-3">
          <h3 className="text-xs font-medium mb-2 text-neutral-400 flex items-center gap-1.5">
            <BarChart3 size={12} className="text-green-500" /> Revenus vs Dépenses
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

      <div className="rounded-lg border border-white/5 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <FolderOpen size={14} className="text-green-500" /> Budget par catégorie — {MONTHS_FULL[selectedMonth]} {selectedYear}
          </h3>
          <Link href="/settings" prefetch={false} className="text-green-500 text-[10px]">Modifier catégories</Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {config.categories.map((cat: Category) => {
            const budget = effectiveCategoryBudgets[cat.id] ?? cat.budget;
            const spent = catSpending[cat.id] || 0;
            const pct = budget > 0 ? (spent / budget) * 100 : 0;
            const isOver = spent > budget;
            return (
              <CategoryBudgetCard
                key={cat.id}
                cat={cat}
                budget={budget}
                spent={spent}
                pct={pct}
                isOver={isOver}
                onSave={(amount) => updateCategoryBudget(cat.id, amount)}
              />
            );
          })}
        </div>
      </div>

      {config.fixedCharges.length > 0 && (
        <div className="rounded-lg border border-white/5 p-4">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <ClipboardList size={14} className="text-red-500" /> Charges fixes
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-2.5">
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
      )}
    </div>
  );
}
