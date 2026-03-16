"use client";
import { motion } from "framer-motion";
import { formatCFA, MONTHS_SHORT } from "@/lib/constants";
import { BudgetConfig, FixedCharge } from "@/lib/types";
import SavingsLineChart from "./charts/SavingsLineChart";
import { Target, TrendingUp, CalendarDays, FolderOpen } from "lucide-react";
import { Project } from "@/lib/types";
import AnimatedProgressBar from "./ui/AnimatedProgressBar";
import SmartGoalsSection from "./SmartGoalsSection";
import { useConfetti } from "@/hooks/useConfetti";

interface BudgetData {
  config: BudgetConfig;
  savings: number[];
  projects: Project[];
  selectedMonth: number;
  totalSaved: number;
  totalSavedManualCumulative: number;
  totalProjectSaved: number;
  resteAVivre: number;
  updateSaving: (month: number, amount: number) => Promise<void>;
}

export default function SavingsTracker({ budget }: { budget: BudgetData }) {
  const { config, savings, projects, selectedMonth, totalSaved, totalSavedManualCumulative, totalProjectSaved, resteAVivre, updateSaving } = budget;
  const fireConfetti = useConfetti();

  const target =
    config.fixedCharges.find((c: FixedCharge) => c.id === "epargne")?.amount || 0;
  const goalPct =
    config.savingsGoal > 0
      ? (totalSaved / config.savingsGoal) * 100
      : 0;
  const goalPctCapped = Math.min(goalPct, 100);

  const handleUpdateSaving = async (month: number, amount: number) => {
    const prevTotal = totalSaved;
    const newTotal = prevTotal - (savings[month] ?? 0) + amount;
    await updateSaving(month, amount);
    if (config.savingsGoal > 0 && prevTotal < config.savingsGoal && newTotal >= config.savingsGoal) {
      fireConfetti();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      <h1 className="text-xl lg:text-2xl font-bold mb-5 lg:mb-6">
        Progression de l&apos;Épargne
      </h1>

      <div className="glass-strong rounded-2xl p-5 lg:p-7 mb-5 lg:mb-6">
        <div className="flex justify-between items-center gap-4 mb-4 lg:mb-5">
          <div className="min-w-0">
            <div className="text-xs lg:text-sm text-slate-400 flex items-center gap-1.5">
              <Target size={14} className="text-amber-400" /> Objectif Fonds d&apos;Urgence
            </div>
            <div className="font-mono text-xl lg:text-3xl font-bold text-amber-400 mt-1">
              {formatCFA(totalSaved)}{" "}
              <span className="text-xs lg:text-base text-slate-500">
                / {formatCFA(config.savingsGoal)}
              </span>
            </div>
          </div>
          <div className="relative w-16 h-16 lg:w-24 lg:h-24 shrink-0">
            <svg viewBox="0 0 36 36" className="w-16 h-16 lg:w-24 lg:h-24 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f59e0b" strokeWidth="3"
                strokeDasharray={`${goalPctCapped} 100`} strokeLinecap="round" className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-mono text-xs lg:text-base font-bold text-amber-400">
                {goalPct.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
        <AnimatedProgressBar
          value={totalSaved}
          max={config.savingsGoal}
          gradient="linear-gradient(90deg,#f59e0b,#fbbf24)"
          duration={1}
          className="h-2 lg:h-2.5"
        />
        <div className="flex justify-between mt-1.5 text-[10px] lg:text-[11px] text-slate-500">
          <span>0</span>
          <span>{formatCFA(config.savingsGoal)} FCFA</span>
        </div>
      </div>

      <SmartGoalsSection
        config={config}
        projects={projects}
        totalSavedManual={totalSavedManualCumulative}
        resteAVivre={resteAVivre}
      />

      <div className="glass-strong rounded-2xl p-4 lg:p-6 mb-5 lg:mb-6">
        <h3 className="text-xs lg:text-sm font-semibold mb-3 lg:mb-4 text-slate-300 flex items-center gap-2">
          <TrendingUp size={14} className="text-emerald-400" /> Courbe d&apos;épargne cumulée
        </h3>
        <SavingsLineChart savings={savings} goal={config.savingsGoal} target={target} />
      </div>

      <div className="glass-strong rounded-2xl p-4 lg:p-6">
        <h3 className="text-xs lg:text-sm font-semibold mb-3 lg:mb-4 flex items-center gap-2">
          <CalendarDays size={14} className="text-emerald-400" /> Épargne Mensuelle
        </h3>
        <p className="text-[10px] lg:text-xs text-slate-500 mb-3">
          Saisis le montant épargné chaque mois.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 lg:gap-3">
          {MONTHS_SHORT.map((m, i) => {
            const actual = savings[i];
            const pct = target > 0 ? (actual / target) * 100 : 0;
            return (
              <div
                key={i}
                className={`flex items-center gap-2 p-2 rounded-xl transition-all ${
                  i === selectedMonth
                    ? "bg-amber-500/15 ring-1 ring-amber-500/40"
                    : actual > 0
                    ? "bg-white/[0.03]"
                    : "bg-white/[0.02]"
                }`}
              >
                <span className={`text-[10px] lg:text-xs font-medium w-8 ${
                  i === selectedMonth ? "text-amber-300" : "text-slate-500"
                }`}>
                  {m}
                </span>
                <input
                  type="number"
                  className="input-field font-mono text-xs lg:text-[13px] py-1.5 px-2 flex-1 min-w-0"
                  placeholder="0"
                  defaultValue={savings[i] || ""}
                  key={`sav-${i}`}
                  onChange={(e) => handleUpdateSaving(i, Number(e.target.value) || 0)}
                />
                {actual > 0 && (
                  <span className={`text-[9px] font-mono flex-shrink-0 ${
                    actual >= target && target > 0 ? "text-emerald-400/70" : "text-amber-400/70"
                  }`}>
                    {pct > 0 ? `${pct.toFixed(0)}%` : formatCFA(actual)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-3 px-3 py-2 rounded-xl"
          style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <span className="font-semibold text-xs lg:text-sm">Total Épargné</span>
          <span className="font-mono text-sm lg:text-lg font-bold text-amber-400">
            {formatCFA(totalSaved)} FCFA
          </span>
        </div>
      </div>

      {projects.length > 0 && (
        <div className="glass-strong rounded-2xl p-4 lg:p-6 mt-5 lg:mt-6">
          <h3 className="text-xs lg:text-sm font-semibold mb-3 lg:mb-4 flex items-center gap-2">
            <FolderOpen size={14} className="text-emerald-400" /> Épargne Projets
          </h3>
          <div className="space-y-2">
            {projects.filter((p: Project) => p.saved_amount > 0 || p.status === "active").map((p: Project) => {
              const pct = p.target_amount > 0 ? (p.saved_amount / p.target_amount) * 100 : 0;
              return (
                <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03]">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: p.color + "22" }}>
                    <Target size={14} style={{ color: p.color }} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{p.name}</div>
                    <AnimatedProgressBar
                      value={p.saved_amount}
                      max={p.target_amount}
                      duration={0.6}
                      className="h-1 mt-1"
                      gradient={`linear-gradient(90deg, ${p.color}, ${p.color}aa)`}
                    />
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-xs font-bold" style={{ color: p.color }}>{formatCFA(p.saved_amount)}</div>
                    <div className="text-[9px] text-slate-500">{pct.toFixed(0)}%</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-3 px-3 py-2 rounded-xl"
            style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>
            <span className="font-semibold text-xs lg:text-sm">Total Projets</span>
            <span className="font-mono text-sm lg:text-lg font-bold text-emerald-400">
              {formatCFA(totalProjectSaved)} FCFA
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
