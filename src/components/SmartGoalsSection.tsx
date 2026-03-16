"use client";

import { formatCFA } from "@/lib/constants";
import { BudgetConfig, Project } from "@/lib/types";
import {
  monthsUntilDeadline,
  monthlySavingsNeeded,
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
  /** Épargne manuelle (fonds d'urgence) — exclut les projets */
  totalSavedManual: number;
  resteAVivre: number;
}

export default function SmartGoalsSection({
  config,
  projects,
  totalSavedManual,
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
  }> = [];

  // Fonds d'urgence avec date cible — utilise uniquement l'épargne manuelle (pas les projets)
  if (config.savingsGoal > 0 && config.savingsGoalDeadline) {
    const months = monthsUntilDeadline(config.savingsGoalDeadline);
    const monthly = monthlySavingsNeeded(config.savingsGoal, totalSavedManual, months);
    if (months > 0 && config.savingsGoal > totalSavedManual) {
      goals.push({
        id: "emergency",
        name: "Fonds d'urgence",
        targetAmount: config.savingsGoal,
        savedAmount: totalSavedManual,
        deadline: config.savingsGoalDeadline,
      });
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
    <div className="glass-strong rounded-2xl p-4 lg:p-6 mb-5 lg:mb-6">
      <h3 className="text-xs lg:text-sm font-semibold mb-3 lg:mb-4 flex items-center gap-2">
        <Lightbulb size={16} className="text-amber-400" /> Objectifs financiers intelligents
      </h3>
      <p className="text-[10px] lg:text-xs text-slate-500 mb-4">
        Suggestions d&apos;épargne mensuelle et faisabilité selon ton reste à vivre.
      </p>
      <div className="space-y-3">
        {goals.map((g) => {
          const months = monthsUntilDeadline(g.deadline);
          const monthly = monthlySavingsNeeded(g.targetAmount, g.savedAmount, months);
          const feasibility = getFeasibility(monthly, resteAVivre);
          const years = Math.floor(months / 12);
          const monthsPart = months % 12;
          const deadlineLabel =
            years > 0
              ? `${years} an${years > 1 ? "s" : ""}${monthsPart > 0 ? ` et ${monthsPart} mois` : ""}`
              : `${months} mois`;

          return (
            <div
              key={g.id}
              className="p-3 lg:p-4 rounded-xl bg-white/[0.03] border border-white/5"
              style={g.color ? { borderLeft: `3px solid ${g.color}` } : { borderLeft: "3px solid #f59e0b" }}
            >
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
                <span className="text-slate-400"> en {deadlineLabel}, épargne </span>
                <span className="font-mono font-bold text-emerald-400">{formatCFA(monthly)}</span>
                <span className="text-slate-400">/mois</span>
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
