"use client";
import { formatCFA } from "@/lib/constants";
import { calculateLoanStats } from "@/lib/loan-calculator";
import AnimatedProgressBar from "./ui/AnimatedProgressBar";
import LoanPieChart from "./charts/LoanPieChart";
import LoanAmortizationChart from "./charts/LoanAmortizationChart";
import LoanBalanceChart from "./charts/LoanBalanceChart";
import LoanNextPayment from "./LoanNextPayment";
import LoanScheduleTable from "./LoanScheduleTable";
import LoanScenarioSimulator from "./LoanScenarioSimulator";
import { Building2, X, AlertTriangle, CheckCircle } from "lucide-react";
import type { Loan, LoanScheduleRow, LoanStats } from "@/lib/types";

interface LoanAnalysisProps {
  loan: Loan;
  schedule: LoanScheduleRow[];
  salary: number;
  onMarkPaid: (number: number, note?: string) => Promise<void>;
  onMarkUnpaid: (number: number) => Promise<void>;
  onClose: () => void;
}

export default function LoanAnalysis({
  loan,
  schedule,
  salary,
  onMarkPaid,
  onMarkUnpaid,
  onClose,
}: LoanAnalysisProps) {
  const stats: LoanStats = calculateLoanStats(schedule, loan, salary);
  const today = new Date().toISOString().split("T")[0];
  const nextDueRow = schedule.find(
    (s) => s.status !== "paid" && s.due_date >= today
  ) || schedule.find((s) => s.status === "overdue" || s.status === "pending");
  const nextDueNumber = nextDueRow?.number ?? null;
  const paidCount = schedule.filter((s) => s.status === "paid").length;
  const totalCount = schedule.length;
  const monthsLeft = totalCount - paidCount;

  const handleMarkPaid = async () => {
    if (nextDueNumber) await onMarkPaid(nextDueNumber);
  };

  return (
    <div className="space-y-4 lg:space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
            <Building2 size={24} className="text-blue-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold truncate">{loan.label}</h2>
            <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 mt-0.5">
              {loan.bank_name && <span>{loan.bank_name}</span>}
              {loan.agency && <span>— {loan.agency}</span>}
              {loan.loan_number && <span>N° {loan.loan_number}</span>}
            </div>
            <span
              className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${
                loan.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"
              }`}
            >
              {loan.status === "completed" ? "Terminé" : "Actif"}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 shrink-0"
          aria-label="Replier l'analyse"
        >
          <X size={20} />
        </button>
      </div>

          {/* KPIs principaux */}
          <div className="grid grid-cols-3 gap-2 lg:gap-4">
            <div className="glass rounded-xl p-3 lg:p-4">
              <div className="text-[9px] lg:text-[11px] text-slate-500">Emprunté</div>
              <div className="font-mono text-sm lg:text-lg font-bold text-slate-200 mt-0.5">
                {formatCFA(stats.totalBorrowed)}
              </div>
            </div>
            <div className="glass rounded-xl p-3 lg:p-4">
              <div className="text-[9px] lg:text-[11px] text-slate-500">Mensualité</div>
              <div className="font-mono text-sm lg:text-lg font-bold text-emerald-400 mt-0.5">
                {formatCFA(stats.monthlyPayment)}
              </div>
            </div>
            <div className="glass rounded-xl p-3 lg:p-4">
              <div className="text-[9px] lg:text-[11px] text-slate-500">Durée</div>
              <div className="font-mono text-sm lg:text-lg font-bold text-slate-200 mt-0.5">
                {totalCount} mois
              </div>
            </div>
          </div>

          {/* KPIs secondaires */}
          <div className="grid grid-cols-3 gap-2 lg:gap-4">
            <div className="glass rounded-xl p-3">
              <div className="text-[9px] text-slate-500">Coût total crédit</div>
              <div className="font-mono text-xs font-bold text-red-400 mt-0.5">{formatCFA(stats.totalCost)}</div>
            </div>
            <div className="glass rounded-xl p-3">
              <div className="text-[9px] text-slate-500">Taux effectif</div>
              <div className="font-mono text-xs font-bold text-amber-400 mt-0.5">
                {loan.effective_rate?.toFixed(2) ?? loan.interest_rate?.toFixed(2) ?? "0"}%
              </div>
            </div>
            <div className="glass rounded-xl p-3">
              <div className="text-[9px] text-slate-500">Taux intérêt</div>
              <div className="font-mono text-xs font-bold text-blue-400 mt-0.5">{loan.interest_rate}%</div>
            </div>
          </div>

          {/* Où tu en es */}
          <div className="grid grid-cols-2 gap-2">
            <div className="glass rounded-xl p-3">
              <div className="text-[9px] text-slate-500">Échéances payées</div>
              <div className="font-mono text-sm font-bold text-emerald-400 mt-0.5">
                {paidCount} / {totalCount}
              </div>
            </div>
            <div className="glass rounded-xl p-3">
              <div className="text-[9px] text-slate-500">Échéances restantes</div>
              <div className="font-mono text-sm font-bold text-amber-400 mt-0.5">{monthsLeft}</div>
            </div>
            <div className="glass rounded-xl p-3">
              <div className="text-[9px] text-slate-500">Capital remboursé</div>
              <div className="font-mono text-sm font-bold text-emerald-400 mt-0.5">
                {formatCFA(stats.totalBorrowed - stats.remainingBalance)}
              </div>
            </div>
            <div className="glass rounded-xl p-3">
              <div className="text-[9px] text-slate-500">Capital restant</div>
              <div className="font-mono text-sm font-bold text-red-400 mt-0.5">{formatCFA(stats.remainingBalance)}</div>
            </div>
          </div>

          {/* Barres de progression */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[10px] text-slate-500 mb-1">Progression capital</div>
              <AnimatedProgressBar
                value={(stats.totalBorrowed - stats.remainingBalance) / stats.totalBorrowed}
                max={1}
                duration={1}
                gradient="linear-gradient(90deg, #10b981, #34d399)"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-slate-500 mb-1">Temps écoulé</div>
              <AnimatedProgressBar
                value={paidCount}
                max={totalCount}
                duration={1}
                gradient="linear-gradient(90deg, #6366f1, #818cf8)"
              />
            </div>
          </div>

          {/* Prochaine échéance */}
          {nextDueRow && (
            <LoanNextPayment
              dueDate={nextDueRow.due_date}
              amount={nextDueRow.total_payment}
              principal={nextDueRow.principal}
              interest={nextDueRow.interest}
              insurance={nextDueRow.insurance}
              daysUntil={stats.daysUntilNextDue}
              isOverdue={nextDueRow.status === "overdue"}
              onMarkPaid={handleMarkPaid}
            />
          )}

          {/* Graphique camembert */}
          <div className="glass rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Décomposition du coût total</h3>
            <LoanPieChart
              totalBorrowed={stats.totalBorrowed}
              totalInterest={stats.totalInterest}
              totalInsurance={stats.totalInsurance}
              totalTaxes={stats.totalTaxes}
              totalFees={stats.totalFees}
            />
          </div>

          {/* Graphique évolution capital/intérêts */}
          <div className="glass rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Capital vs Intérêts par échéance</h3>
            <LoanAmortizationChart schedule={schedule} currentNumber={paidCount + 1} />
          </div>

          {/* Graphique capital restant */}
          <div className="glass rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Capital restant dû</h3>
            <LoanBalanceChart schedule={schedule} />
          </div>

          {/* Impact budget */}
          <div className="grid grid-cols-2 gap-2">
            <div className="glass rounded-xl p-3">
              <div className="text-[9px] text-slate-500">Taux d'endettement</div>
              <div
                className={`font-mono text-sm font-bold mt-0.5 ${
                  stats.debtRatio > 33 ? "text-amber-400" : stats.debtRatio > 20 ? "text-slate-300" : "text-emerald-400"
                }`}
              >
                {stats.debtRatio.toFixed(1)}%
              </div>
            </div>
            <div className="glass rounded-xl p-3">
              <div className="text-[9px] text-slate-500">Part charges fixes</div>
              <div className="font-mono text-sm font-bold text-slate-300 mt-0.5">
                {salary > 0 ? ((stats.monthlyPayment / salary) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>

          {/* Tableau d'amortissement */}
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Tableau d'amortissement</h3>
            <LoanScheduleTable
              schedule={schedule}
              nextDueNumber={nextDueNumber}
              onMarkPaid={onMarkPaid}
              onMarkUnpaid={onMarkUnpaid}
            />
          </div>

          {/* Simulateur remboursement anticipé */}
          {stats.remainingBalance > 0 && stats.monthlyPayment > 0 && (
            <LoanScenarioSimulator
              remainingBalance={stats.remainingBalance}
              annualRate={loan.interest_rate || 0}
              currentMonthly={stats.monthlyPayment}
              insuranceRate={loan.insurance_rate}
              taxRate={loan.tax_rate}
            />
          )}

          {/* Recommandations */}
          <div className="space-y-2">
            {stats.overdueCount > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-red-300">Échéance(s) en retard</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {stats.overdueCount} échéance(s) à régulariser
                  </div>
                </div>
              </div>
            )}
            {stats.debtRatio > 33 && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-amber-300">Taux d'endettement élevé</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {stats.debtRatio.toFixed(0)}% — recommandé &lt; 33%
                  </div>
                </div>
              </div>
            )}
            {monthsLeft > 0 && monthsLeft <= 6 && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-emerald-300">Bientôt terminé !</div>
                  <div className="text-xs text-slate-400 mt-0.5">Plus que {monthsLeft} mois</div>
                </div>
              </div>
            )}
          </div>
        </div>
  );
}
