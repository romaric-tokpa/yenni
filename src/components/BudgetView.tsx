"use client";
import { formatCFA } from "@/lib/constants";
import { BudgetConfig, Category } from "@/lib/types";
import Icon from "./ui/Icon";
import { Coins, CircleCheck, CircleAlert, CircleMinus, TrendingUp, TrendingDown, Scale } from "lucide-react";

interface BudgetData {
  config: BudgetConfig;
  totalIncome: number;
  totalFixed: number;
  totalExpenses: number;
  soldeNet: number;
  totalBudgetVar: number;
  totalMonthSpent: number;
  monthSaving: number;
  resteAVivre: number;
  catSpending: Record<string, number>;
}

export default function BudgetView({ budget }: { budget: BudgetData }) {
  const { config, totalIncome, totalFixed, totalExpenses, soldeNet, totalBudgetVar, totalMonthSpent, monthSaving, catSpending } = budget;
  const available = totalIncome - totalFixed - totalBudgetVar;

  return (
    <div className="animate-slide-up">
      <h1 className="text-xl lg:text-2xl font-bold mb-5 lg:mb-6">Répartition du Budget</h1>

      <div className="glass-strong rounded-2xl p-4 lg:p-6 mb-5 lg:mb-6">
        <h3 className="text-xs lg:text-sm font-semibold mb-4 lg:mb-5 flex items-center gap-2">
          <Coins size={16} className="text-emerald-400" /> Salaire — {formatCFA(totalIncome)} FCFA
        </h3>
        {totalIncome > 0 ? (
          <div className="flex h-8 lg:h-10 rounded-xl overflow-hidden mb-4 lg:mb-5">
            <div
              className="flex items-center justify-center text-[9px] lg:text-[11px] font-bold"
              style={{
                width: `${(totalFixed / totalIncome) * 100}%`,
                background: "linear-gradient(90deg,#ef4444,#f87171)",
                minWidth: 30,
              }}
            >
              {((totalFixed / totalIncome) * 100).toFixed(0)}%
            </div>
            <div
              className="flex items-center justify-center text-[9px] lg:text-[11px] font-bold"
              style={{
                width: `${(totalBudgetVar / totalIncome) * 100}%`,
                background: "linear-gradient(90deg,#6366f1,#818cf8)",
                minWidth: 30,
              }}
            >
              {((totalBudgetVar / totalIncome) * 100).toFixed(0)}%
            </div>
            <div
              className="flex-1 flex items-center justify-center text-[9px] lg:text-[11px] font-bold"
              style={{ background: "linear-gradient(90deg,#10b981,#34d399)" }}
            >
              {((available / totalIncome) * 100).toFixed(0)}%
            </div>
          </div>
        ) : (
          <div className="h-8 lg:h-10 rounded-xl bg-white/5 flex items-center justify-center text-xs text-slate-500 mb-4 lg:mb-5">
            Renseigne ton salaire dans les réglages
          </div>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center text-[10px] lg:text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-red-500" />
            Fixes ({formatCFA(totalFixed)})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-indigo-500" />
            Variables ({formatCFA(totalBudgetVar)})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-emerald-500" />
            Dispo ({formatCFA(available)})
          </span>
        </div>
      </div>

      {/* Bilan comptable : Actifs vs Passifs */}
      <div className="grid grid-cols-3 gap-2 lg:gap-4 mb-5 lg:mb-6">
        <div className="glass rounded-xl lg:rounded-2xl p-3 lg:p-5">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={14} className="text-emerald-400" />
            <span className="text-[9px] lg:text-[11px] text-slate-500">Actifs</span>
          </div>
          <div className="font-mono text-sm lg:text-xl font-bold text-emerald-400">
            {formatCFA(totalIncome)}
          </div>
        </div>
        <div className="glass rounded-xl lg:rounded-2xl p-3 lg:p-5">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown size={14} className="text-red-400" />
            <span className="text-[9px] lg:text-[11px] text-slate-500">Passifs</span>
          </div>
          <div className="font-mono text-sm lg:text-xl font-bold text-red-400">
            {formatCFA(totalExpenses)}
          </div>
          <div className="text-[8px] lg:text-[10px] text-slate-600 mt-0.5">
            Fixes {formatCFA(totalFixed)} + Dép. {formatCFA(totalMonthSpent)} + Ép. {formatCFA(monthSaving)}
          </div>
        </div>
        <div className="glass rounded-xl lg:rounded-2xl p-3 lg:p-5">
          <div className="flex items-center gap-1.5 mb-1">
            <Scale size={14} className={soldeNet >= 0 ? "text-indigo-400" : "text-red-400"} />
            <span className="text-[9px] lg:text-[11px] text-slate-500">Solde net</span>
          </div>
          <div className={`font-mono text-sm lg:text-xl font-bold ${soldeNet >= 0 ? "text-indigo-400" : "text-red-400"}`}>
            {soldeNet >= 0 ? "+" : "-"}{formatCFA(Math.abs(soldeNet))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        {config.categories.map((cat: Category) => {
          const spent = catSpending[cat.id] || 0;
          const pct = cat.budget > 0 ? (spent / cat.budget) * 100 : 0;
          return (
            <div
              key={cat.id}
              className="glass kpi-card rounded-2xl p-4 lg:p-5"
              style={{ borderLeft: `3px solid ${cat.color}` }}
            >
              <div className="flex justify-between mb-2 lg:mb-3">
                <span className="text-xs lg:text-[13px] font-medium flex items-center gap-1.5">
                  <Icon name={cat.icon} size={14} style={{ color: cat.color }} />
                  {cat.label}
                </span>
                <span>
                  {pct > 100 ? (
                    <CircleMinus size={16} className="text-red-400" />
                  ) : pct > 80 ? (
                    <CircleAlert size={16} className="text-amber-400" />
                  ) : (
                    <CircleCheck size={16} className="text-emerald-400" />
                  )}
                </span>
              </div>
              <div className="font-mono text-lg lg:text-xl font-bold" style={{ color: cat.color }}>
                {formatCFA(cat.budget)}
              </div>
              <div className="text-[10px] lg:text-[11px] text-slate-500 mt-0.5">
                Dépensé: {formatCFA(spent)} ({pct.toFixed(0)}%)
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-2 lg:mt-3">
                <div
                  className="progress-bar h-full rounded-full"
                  style={{ width: `${Math.min(pct, 100)}%`, background: cat.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
