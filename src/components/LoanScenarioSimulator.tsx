"use client";
import { useState, useMemo } from "react";
import { formatCFA } from "@/lib/constants";
import { simulateEarlyRepayment } from "@/lib/loan-calculator";

interface LoanScenarioSimulatorProps {
  remainingBalance: number;
  annualRate: number;
  currentMonthly: number;
  insuranceRate?: number;
  taxRate?: number;
}

export default function LoanScenarioSimulator({
  remainingBalance,
  annualRate,
  currentMonthly,
  insuranceRate = 0,
  taxRate = 0,
}: LoanScenarioSimulatorProps) {
  const [multiplier, setMultiplier] = useState(1);
  const newMonthly = Math.round(currentMonthly * multiplier);

  const sim = useMemo(
    () =>
      simulateEarlyRepayment({
        remainingBalance,
        annualRate,
        currentMonthly,
        newMonthly,
        insuranceRate,
        taxRate,
      }),
    [remainingBalance, annualRate, currentMonthly, newMonthly, insuranceRate, taxRate]
  );

  const minMult = 1;
  const maxMult = 2;
  const step = 0.1;

  return (
    <div className="glass rounded-2xl p-4 lg:p-5">
      <h3 className="text-sm font-semibold text-slate-200 mb-3">Simulateur de remboursement anticipé</h3>
      <div className="mb-4">
        <label className="text-[10px] text-slate-500 block mb-1">
          Nouvelle mensualité : {formatCFA(newMonthly)} FCFA
        </label>
        <input
          type="range"
          min={minMult}
          max={maxMult}
          step={step}
          value={multiplier}
          onChange={(e) => setMultiplier(parseFloat(e.target.value))}
          className="w-full h-2 rounded-full accent-emerald-500"
        />
        <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
          <span>{formatCFA(currentMonthly)}</span>
          <span>{formatCFA(currentMonthly * 2)}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded-lg bg-white/5">
          <div className="text-slate-500 text-[10px]">Nouvelle durée</div>
          <div className="font-mono font-semibold text-emerald-400">{sim.newDuration} mois</div>
        </div>
        <div className="p-2 rounded-lg bg-white/5">
          <div className="text-slate-500 text-[10px]">Économie intérêts</div>
          <div className="font-mono font-semibold text-emerald-400">{formatCFA(sim.savedInterest)}</div>
        </div>
        <div className="p-2 rounded-lg bg-white/5">
          <div className="text-slate-500 text-[10px]">Mois gagnés</div>
          <div className="font-mono font-semibold text-indigo-400">{sim.savedMonths}</div>
        </div>
        <div className="p-2 rounded-lg bg-white/5">
          <div className="text-slate-500 text-[10px]">Nouvelle fin</div>
          <div className="font-mono font-semibold text-slate-300 text-[10px]">
            {sim.newEndDate ? new Date(sim.newEndDate).toLocaleDateString("fr-FR", { month: "short", year: "numeric" }) : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
