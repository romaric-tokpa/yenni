"use client";
import { motion } from "framer-motion";
import { formatCFA, MONTHS_SHORT, getLinkedVaultEmergencyBalance } from "@/lib/constants";
import { BudgetConfig, FixedCharge, Project, AccountWithBalance } from "@/lib/types";
import SavingsLineChart from "./charts/SavingsLineChart";
import {
  Target,
  TrendingUp,
  CalendarDays,
  FolderOpen,
  PiggyBank,
  ChevronLeft,
  ChevronRight,
  Settings,
  Plus,
  Pencil,
  Check,
} from "lucide-react";
import AnimatedProgressBar from "./ui/AnimatedProgressBar";
import SmartGoalsSection from "./SmartGoalsSection";
import { useConfetti } from "@/hooks/useConfetti";
import Link from "next/link";
import { useMemo, useRef, useCallback, useEffect, useState } from "react";

/** Évite d’envoyer une requête à chaque frappe (champ vide = 0 provoquait un gros « retrait » coffre verrouillé). */
const SAVING_INPUT_DEBOUNCE_MS = 480;

interface BudgetData {
  config: BudgetConfig;
  savings: number[];
  projects: Project[];
  selectedMonth: number;
  selectedYear: number;
  setSelectedYear: (y: number) => void;
  totalSaved: number;
  totalSavedManualCumulative: number;
  savedInPeriod?: number | null;
  totalProjectSaved: number;
  resteAVivre: number;
  monthSaving: number;
  totalIncome: number;
  updateSaving: (month: number, amount: number) => Promise<void>;
  accountsWithBalance: AccountWithBalance[];
}

export default function SavingsTracker({ budget }: { budget: BudgetData }) {
  const {
    config,
    savings,
    projects,
    selectedMonth,
    selectedYear,
    setSelectedYear,
    totalSaved,
    totalSavedManualCumulative,
    savedInPeriod,
    totalProjectSaved,
    resteAVivre,
    monthSaving,
    totalIncome,
    updateSaving,
    accountsWithBalance,
  } = budget;
  const fireConfetti = useConfetti();
  const [monthlySavingsEditing, setMonthlySavingsEditing] = useState(false);
  const monthlySavingsSectionRef = useRef<HTMLDivElement>(null);

  const emergencyVaultBalance = useMemo(
    () => getLinkedVaultEmergencyBalance(config, accountsWithBalance),
    [config, accountsWithBalance],
  );
  const emergencyProgressAmount =
    emergencyVaultBalance != null ? emergencyVaultBalance : totalSaved;

  const target =
    config.fixedCharges.find((c: FixedCharge) => c.id === "epargne")?.amount || 0;
  const goalPct =
    config.savingsGoal > 0 ? (emergencyProgressAmount / config.savingsGoal) * 100 : 0;
  const goalPctCapped = Math.min(goalPct, 100);
  const savingsRate =
    totalIncome > 0 ? ((monthSaving + totalProjectSaved) / totalIncome) * 100 : 0;

  const savingDebounceRef = useRef<Record<number, ReturnType<typeof setTimeout> | undefined>>(
    {},
  );

  const commitSavingMonth = useCallback(
    async (month: number, amount: number) => {
      const prevTotal = totalSaved;
      const newTotal = prevTotal - (savings[month] ?? 0) + amount;
      await updateSaving(month, amount);
      if (
        emergencyVaultBalance == null &&
        config.savingsGoal > 0 &&
        prevTotal < config.savingsGoal &&
        newTotal >= config.savingsGoal
      ) {
        fireConfetti();
      }
    },
    [
      totalSaved,
      savings,
      updateSaving,
      emergencyVaultBalance,
      config.savingsGoal,
      fireConfetti,
    ],
  );

  const scheduleSavingInputUpdate = useCallback(
    (month: number, raw: string) => {
      const trimmed = raw.trim();
      /* Champ vide pendant la saisie : on n’envoie pas 0 (sinon delta négatif massif + coffre verrouillé). */
      if (trimmed === "") return;
      const n = Number(trimmed.replace(",", "."));
      if (!Number.isFinite(n) || n < 0) return;
      const amount = Math.round(n);
      const prev = savingDebounceRef.current[month];
      if (prev) clearTimeout(prev);
      savingDebounceRef.current[month] = setTimeout(() => {
        savingDebounceRef.current[month] = undefined;
        void commitSavingMonth(month, amount);
      }, SAVING_INPUT_DEBOUNCE_MS);
    },
    [commitSavingMonth],
  );

  const flushSavingInputOnBlur = useCallback(
    (month: number, raw: string) => {
      const pending = savingDebounceRef.current[month];
      if (pending) {
        clearTimeout(pending);
        savingDebounceRef.current[month] = undefined;
      }
      const trimmed = raw.trim();
      const amount =
        trimmed === ""
          ? 0
          : Math.max(0, Math.round(Number(trimmed.replace(",", ".")) || 0));
      void commitSavingMonth(month, amount);
    },
    [commitSavingMonth],
  );

  useEffect(() => {
    return () => {
      Object.values(savingDebounceRef.current).forEach((id) => {
        if (id) clearTimeout(id);
      });
    };
  }, []);

  useEffect(() => {
    setMonthlySavingsEditing(false);
  }, [selectedYear]);

  const finishMonthlySavingsEditing = useCallback(() => {
    const root = monthlySavingsSectionRef.current;
    root?.querySelectorAll("input").forEach((el) => {
      (el as HTMLInputElement).blur();
    });
    setMonthlySavingsEditing(false);
  }, []);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-lg font-semibold">Épargne</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedYear(selectedYear - 1)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 transition-colors"
            aria-label="Année précédente"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="font-mono text-sm font-semibold text-slate-200 min-w-[4rem] text-center">
            {selectedYear}
          </span>
          <button
            onClick={() => setSelectedYear(selectedYear + 1)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 transition-colors"
            aria-label="Année suivante"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4"
      >
        <motion.div variants={item} className="rounded-lg border border-white/5 p-3">
          <div className="flex items-center gap-1.5 mb-0.5">
            <PiggyBank size={12} className="text-amber-500" />
            <span className="text-[9px] text-neutral-500">
              Total épargné
            </span>
          </div>
          <div className="font-mono text-sm font-semibold text-amber-500">
            {formatCFA(totalSaved)}
          </div>
        </motion.div>
        <motion.div variants={item} className="rounded-lg border border-white/5 p-3">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Target size={12} className="text-green-500" />
            <span className="text-[9px] text-neutral-500">Fonds d&apos;urgence</span>
          </div>
          <div className="font-mono text-sm font-semibold text-green-500">
            {formatCFA(
              emergencyVaultBalance != null ? emergencyVaultBalance : totalSavedManualCumulative,
            )}
          </div>
          {emergencyVaultBalance != null && (
            <p className="text-[8px] text-neutral-600 mt-0.5 leading-tight">Lié au coffre</p>
          )}
        </motion.div>
        <motion.div variants={item} className="rounded-lg border border-white/5 p-3">
          <div className="flex items-center gap-1.5 mb-0.5">
            <FolderOpen size={12} className="text-indigo-500" />
            <span className="text-[9px] text-neutral-500">Projets</span>
          </div>
          <div className="font-mono text-sm font-semibold text-indigo-500">
            {formatCFA(totalProjectSaved)}
          </div>
        </motion.div>
        <motion.div variants={item} className="rounded-lg border border-white/5 p-3">
          <div className="flex items-center gap-1.5 mb-0.5">
            <TrendingUp size={12} className="text-cyan-500" />
            <span className="text-[9px] text-neutral-500">Taux</span>
          </div>
          <div className={`font-mono text-sm font-semibold ${savingsRate >= 20 ? "text-green-500" : savingsRate >= 10 ? "text-amber-500" : "text-neutral-500"}`}>
            {savingsRate.toFixed(1)}%
          </div>
        </motion.div>
      </motion.div>

      {/* Objectif Fonds d'urgence */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-lg border border-white/5 p-4 mb-4"
      >
        <div className="flex justify-between items-center gap-4 mb-4 lg:mb-5">
          <div className="min-w-0">
            <div className="text-xs lg:text-sm text-slate-400 flex items-center gap-1.5">
              <Target size={14} className="text-amber-400" /> Objectif Fonds
              d&apos;Urgence
            </div>
            <div className="font-mono text-xl lg:text-3xl font-bold text-amber-400 mt-1">
              {formatCFA(emergencyProgressAmount)}{" "}
              <span className="text-xs lg:text-base text-slate-500 font-normal">
                / {formatCFA(config.savingsGoal || 0)}
              </span>
            </div>
            {emergencyVaultBalance != null && (
              <p className="text-[10px] text-amber-200/70 mt-1">
                Progression = solde du compte coffre lié (Réglages → Fonds d&apos;urgence).
              </p>
            )}
          </div>
          <div className="relative w-16 h-16 lg:w-24 lg:h-24 shrink-0">
            <svg
              viewBox="0 0 36 36"
              className="w-16 h-16 lg:w-24 lg:h-24 -rotate-90"
            >
              <circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="3"
                strokeDasharray={`${goalPctCapped} 100`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-mono text-xs lg:text-base font-bold text-amber-400">
                {goalPct.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
        {config.savingsGoal > 0 ? (
          <>
            <AnimatedProgressBar
              value={emergencyProgressAmount}
              max={config.savingsGoal}
              gradient="linear-gradient(90deg,#f59e0b,#fbbf24)"
              duration={1}
              className="h-2 lg:h-2.5"
            />
            <div className="flex justify-between mt-1.5 text-[10px] lg:text-[11px] text-slate-500">
              <span>0</span>
              <span>{formatCFA(config.savingsGoal)} FCFA</span>
            </div>
          </>
        ) : (
          <Link
            href="/settings"
            prefetch={false}
            className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs lg:text-sm hover:bg-amber-500/15 transition-colors"
          >
            <Settings size={16} />
            Définir un objectif dans les réglages
          </Link>
        )}
      </motion.div>

      <SmartGoalsSection
        config={config}
        projects={projects}
        totalSavedManual={totalSavedManualCumulative}
        savedInPeriod={savedInPeriod ?? undefined}
        emergencyVaultBalance={emergencyVaultBalance}
        resteAVivre={resteAVivre}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-strong rounded-2xl p-4 lg:p-6 mb-5 lg:mb-6"
      >
        <h3 className="text-xs lg:text-sm font-semibold mb-3 lg:mb-4 text-slate-300 flex items-center gap-2">
          <TrendingUp size={14} className="text-emerald-400" /> Courbe
          d&apos;épargne cumulée
        </h3>
        <SavingsLineChart
          savings={savings}
          goal={config.savingsGoal}
          target={target}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-strong rounded-2xl p-4 lg:p-6"
      >
        <div ref={monthlySavingsSectionRef}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3 lg:mb-4">
          <h3 className="text-xs lg:text-sm font-semibold flex items-center gap-2">
            <CalendarDays size={14} className="text-emerald-400" /> Épargne
            Mensuelle
          </h3>
          {monthlySavingsEditing ? (
            <button
              type="button"
              onClick={finishMonthlySavingsEditing}
              className="inline-flex items-center justify-center gap-1.5 self-start sm:self-auto px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-[11px] lg:text-xs font-semibold hover:bg-emerald-500/25 transition-colors"
            >
              <Check size={14} strokeWidth={2.25} />
              Terminer
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMonthlySavingsEditing(true)}
              className="inline-flex items-center justify-center gap-1.5 self-start sm:self-auto px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-[11px] lg:text-xs font-semibold hover:bg-white/10 transition-colors"
            >
              <Pencil size={14} strokeWidth={2} />
              Modifier
            </button>
          )}
        </div>
        <p className="text-[10px] lg:text-xs text-slate-500 mb-3">
          {monthlySavingsEditing
            ? `Saisis le montant épargné pour chaque mois de ${selectedYear}, puis Terminer.`
            : `Montants épargnés en ${selectedYear}. Clique sur Modifier pour les changer.`}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 lg:gap-3">
          {MONTHS_SHORT.map((m, i) => {
            const actual = savings[i];
            const pct = target > 0 ? (actual / target) * 100 : 0;
            const isCurrent =
              selectedMonth === i &&
              new Date().getFullYear() === selectedYear;
            return (
              <div
                key={i}
                className={`flex flex-col gap-1.5 p-2.5 rounded-xl transition-all ${
                  isCurrent
                    ? "bg-amber-500/15 ring-1 ring-amber-500/40"
                    : actual > 0
                      ? "bg-white/[0.03]"
                      : "bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] lg:text-xs font-medium ${
                      isCurrent ? "text-amber-300" : "text-slate-500"
                    }`}
                  >
                    {m}
                  </span>
                  {actual > 0 && (
                    <span
                      className={`text-[9px] font-mono flex-shrink-0 ${
                        actual >= target && target > 0
                          ? "text-emerald-400/70"
                          : "text-amber-400/70"
                      }`}
                    >
                      {pct > 0 ? `${pct.toFixed(0)}%` : formatCFA(actual)}
                    </span>
                  )}
                </div>
                {monthlySavingsEditing ? (
                  <input
                    type="number"
                    className="input-field font-mono text-xs lg:text-[13px] py-1.5 px-2 w-full min-w-0"
                    placeholder="0"
                    defaultValue={savings[i] || ""}
                    key={`sav-${selectedYear}-${i}-edit`}
                    onChange={(e) => scheduleSavingInputUpdate(i, e.target.value)}
                    onBlur={(e) => flushSavingInputOnBlur(i, e.target.value)}
                  />
                ) : (
                  <div
                    className="font-mono text-xs lg:text-[13px] py-1.5 px-2 w-full min-w-0 rounded-lg border border-white/[0.06] bg-black/20 text-slate-200 tabular-nums"
                    aria-label={`Épargne ${m} ${selectedYear}`}
                  >
                    {formatCFA(actual ?? 0)} <span className="text-[10px] text-slate-500 font-normal">F</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div
          className="flex justify-between mt-4 px-3 py-2.5 rounded-xl"
          style={{
            background: "rgba(245,158,11,0.1)",
            border: "1px solid rgba(245,158,11,0.2)",
          }}
        >
          <span className="font-semibold text-xs lg:text-sm">
            Total {selectedYear}
          </span>
          <span className="font-mono text-sm lg:text-lg font-bold text-amber-400">
            {formatCFA(totalSaved)} FCFA
          </span>
        </div>
        </div>
      </motion.div>

      {projects.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-strong rounded-2xl p-4 lg:p-6 mt-5 lg:mt-6"
        >
          <div className="flex items-center justify-between mb-3 lg:mb-4">
            <h3 className="text-xs lg:text-sm font-semibold flex items-center gap-2">
              <FolderOpen size={14} className="text-emerald-400" /> Épargne
              Projets
            </h3>
            <Link
              href="/projects"
              prefetch={false}
              className="text-[10px] lg:text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              <Plus size={12} /> Voir tout
            </Link>
          </div>
          <div className="space-y-2">
            {projects
              .filter(
                (p: Project) => p.saved_amount > 0 || p.status === "active"
              )
              .slice(0, 5)
              .map((p: Project) => {
                const pct =
                  p.target_amount > 0
                    ? (p.saved_amount / p.target_amount) * 100
                    : 0;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
                  >
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: p.color + "22" }}
                    >
                      <Target size={14} style={{ color: p.color }} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        {p.name}
                      </div>
                      <AnimatedProgressBar
                        value={p.saved_amount}
                        max={p.target_amount}
                        duration={0.6}
                        className="h-1 mt-1"
                        gradient={`linear-gradient(90deg, ${p.color}, ${p.color}aa)`}
                      />
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className="font-mono text-xs font-bold"
                        style={{ color: p.color }}
                      >
                        {formatCFA(p.saved_amount)}
                      </div>
                      <div className="text-[9px] text-slate-500">
                        {pct.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          <div
            className="flex justify-between mt-3 px-3 py-2 rounded-xl"
            style={{
              background: "rgba(99,102,241,0.1)",
              border: "1px solid rgba(99,102,241,0.2)",
            }}
          >
            <span className="font-semibold text-xs lg:text-sm">
              Total Projets
            </span>
            <span className="font-mono text-sm lg:text-lg font-bold text-emerald-400">
              {formatCFA(totalProjectSaved)} FCFA
            </span>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass rounded-2xl p-8 lg:p-12 mt-5 lg:mt-6 text-center"
        >
          <FolderOpen size={40} className="mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-400 mb-2">
            Aucun projet d&apos;épargne
          </p>
          <p className="text-xs text-slate-500 mb-4">
            Crée des projets pour suivre tes objectifs (vacances, voiture...)
          </p>
          <Link
            href="/projects"
            prefetch={false}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 transition-colors"
          >
            <Plus size={14} /> Créer un projet
          </Link>
        </motion.div>
      )}
    </motion.div>
  );
}
