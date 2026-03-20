"use client";

import { formatCFA } from "@/lib/constants";
import { BudgetConfig, Project } from "@/lib/types";
import {
  monthsUntilDeadline,
  monthsRemainingInPeriod,
  monthlySavingsNeeded,
  monthlySavingsFixed,
  getFeasibility,
  getFeasibilityLabel,
  getFeasibilityBg,
  getFeasibilityColor,
} from "@/lib/goalUtils";
import { Target, Lightbulb, Calendar } from "lucide-react";
import Icon from "./ui/Icon";

interface SmartGoalsSectionProps {
  config: BudgetConfig;
  projects: Project[];
  /** Épargne manuelle cumulée (tous temps) — fallback */
  totalSavedManual: number;
  /** Épargne réalisée dans la période [début, cible] — prend en compte les variations mensuelles */
  savedInPeriod?: number;
  /** Si défini : solde du coffre lié au fonds d’urgence (remplace l’épargne manuelle pour cet objectif). */
  emergencyVaultBalance?: number | null;
  resteAVivre: number;
}

export default function SmartGoalsSection({
  config,
  projects,
  totalSavedManual,
  savedInPeriod,
  emergencyVaultBalance = null,
  resteAVivre,
}: SmartGoalsSectionProps) {
  const goals: Array<{
    id: string;
    name: string;
    targetAmount: number;
    savedAmount: number;
    deadline: string;
    color?: string;
    icon?: string;
    /** Mensualité précalculée (période d'épargne) */
    monthly?: number;
    months?: number;
    periodLabel?: string;
  }> = [];

  // Fonds d'urgence — période d'épargne (début → cible) ou simple date cible
  // savedInPeriod = épargne uniquement dans la période (prise en compte des variations mensuelles)
  const savedForGoalManual = (config.savingsGoalStartDate && config.savingsGoalDeadline && savedInPeriod !== undefined)
    ? savedInPeriod
    : totalSavedManual;
  const savedForGoal =
    emergencyVaultBalance != null ? emergencyVaultBalance : savedForGoalManual;

  if (config.savingsGoal > 0 && config.savingsGoalDeadline) {
    const deadline = config.savingsGoalDeadline;
    const startDate = config.savingsGoalStartDate;

    if (startDate && startDate < deadline) {
      // Période définie : calcul adapté au cadre temporel et aux montants déjà épargnés (variables)
      const { totalMonths, monthsLeft, hasStarted } = monthsRemainingInPeriod(startDate, deadline);
      if (monthsLeft <= 0) {
        // Période terminée — n'afficher que si objectif non atteint
        if (config.savingsGoal > savedForGoal) {
          goals.push({
            id: "emergency",
            name: "Fonds d'urgence",
            targetAmount: config.savingsGoal,
            savedAmount: savedForGoal,
            deadline,
            monthly: 0,
            months: 0,
            periodLabel: "Période terminée",
          });
        }
      } else if (!hasStarted) {
        // Avant le début : mensualité prévue = objectif / total mois
        const monthly = monthlySavingsFixed(config.savingsGoal, totalMonths);
        const periodLabel = `Période : ${totalMonths} mois (début ${new Date(startDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })})`;
        if (config.savingsGoal > savedForGoal) {
          goals.push({
            id: "emergency",
            name: "Fonds d'urgence",
            targetAmount: config.savingsGoal,
            savedAmount: savedForGoal,
            deadline,
            monthly,
            months: totalMonths,
            periodLabel,
          });
        }
      } else {
        // Pendant la période : mensualité = (objectif - déjà épargné) / mois restants
        // Prend en compte les montants variables épargnés chaque mois
        const monthly = monthlySavingsNeeded(config.savingsGoal, savedForGoal, monthsLeft);
        const periodLabel = `Période : ${totalMonths} mois (${monthsLeft} restants)`;
        if (config.savingsGoal > savedForGoal) {
          goals.push({
            id: "emergency",
            name: "Fonds d'urgence",
            targetAmount: config.savingsGoal,
            savedAmount: savedForGoal,
            deadline,
            monthly,
            months: monthsLeft,
            periodLabel,
          });
        }
      }
    } else {
      // Pas de date de début : comportement classique (mois restants jusqu'à la cible)
      const months = monthsUntilDeadline(deadline);
      if (months > 0 && config.savingsGoal > savedForGoal) {
        goals.push({
          id: "emergency",
          name: "Fonds d'urgence",
          targetAmount: config.savingsGoal,
          savedAmount: savedForGoal,
          deadline,
        });
      }
    }
  }

  // Projets avec échéance
  projects
    .filter((p) => p.status === "active" && p.deadline && p.target_amount > p.saved_amount)
    .forEach((p) => {
      goals.push({
        id: `project-${p.id}`,
        name: p.name,
        targetAmount: p.target_amount,
        savedAmount: p.saved_amount,
        deadline: p.deadline,
        color: p.color,
        icon: p.icon,
      });
    });

  if (goals.length === 0) return null;

  return (
    <div className="rounded-lg border border-white/5 p-4 mb-4">
      <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
        <Lightbulb size={14} className="text-amber-500" /> Objectifs
      </h3>
      <div className="space-y-3">
        {goals.map((g) => {
          const months = g.months ?? monthsUntilDeadline(g.deadline);
          const monthly = g.monthly ?? monthlySavingsNeeded(g.targetAmount, g.savedAmount, months);
          const feasibility = getFeasibility(monthly, resteAVivre);
          const years = Math.floor(months / 12);
          const monthsPart = months % 12;
          const deadlineLabel = g.periodLabel ?? (
            years > 0
              ? `${years} an${years > 1 ? "s" : ""}${monthsPart > 0 ? ` et ${monthsPart} mois` : ""}`
              : `${months} mois`
          );

          return (
            <div key={g.id} className="p-3 rounded-lg border border-white/5" style={g.color ? { borderLeft: `3px solid ${g.color}` } : { borderLeft: "3px solid #f59e0b" }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {g.icon ? (
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: (g.color || "#f59e0b") + "22" }}
                    >
                      <Icon name={g.icon} size={16} style={{ color: g.color || "#f59e0b" }} />
                    </span>
                  ) : (
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-amber-500/20">
                      <Target size={16} className="text-amber-400" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{g.name}</div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Calendar size={10} />
                      {new Date(g.deadline).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}{" "}
                      ({deadlineLabel})
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${getFeasibilityBg(feasibility)} ${getFeasibilityColor(feasibility)}`}
                >
                  {getFeasibilityLabel(feasibility)}
                </span>
              </div>
              <div className="text-sm lg:text-base">
                <span className="text-slate-400">Pour atteindre </span>
                <span className="font-mono font-bold" style={{ color: g.color || "#f59e0b" }}>
                  {formatCFA(g.targetAmount)}
                </span>
                {months > 0 ? (
                  <>
                    <span className="text-slate-400"> en {deadlineLabel}, épargne </span>
                    <span className="font-mono font-bold text-emerald-400">{formatCFA(monthly)}</span>
                    <span className="text-slate-400">/mois</span>
                    <span className="text-slate-500 text-xs ml-1">
                      ({g.periodLabel ? "période définie" : "adapté au reste à épargner"})
                    </span>
                  </>
                ) : (
                  <span className="text-slate-500 text-xs ml-1"> — {deadlineLabel}</span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-1.5">
                Déjà épargné : {formatCFA(g.savedAmount)} — Reste : {formatCFA(Math.max(0, g.targetAmount - g.savedAmount))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
