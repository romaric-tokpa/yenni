"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatCFA } from "@/lib/constants";
import { Loan, LoanPayment } from "@/lib/types";
import Icon from "./ui/Icon";
import AnimatedProgressBar from "./ui/AnimatedProgressBar";
import LoanAnalysis from "./LoanAnalysis";
import {
  Plus, X, Check, Trash2, Pencil, Clock, Banknote, ArrowDownLeft, ArrowUpRight,
  Building2, Users, HandCoins, ChevronDown, ChevronUp, AlertTriangle,
  CircleCheck, CircleAlert, BarChart3, Loader2,
} from "lucide-react";

const LOAN_TYPES = [
  {
    id: "bank" as const,
    label: "Prêt bancaire",
    desc: "Crédit auprès d'une banque ou organisme. La somme entre dans ta trésorerie. Les remboursements mensuels en sortent.",
    icon: "landmark",
    Icon: Building2,
    color: "#3B82F6",
    actionLabel: "Rembourser",
    actionIcon: ArrowUpRight,
    payLabel: "Remboursement",
  },
  {
    id: "personal_borrowed" as const,
    label: "J'ai emprunté",
    desc: "Somme reçue d'un ami ou de la famille. Elle entre dans ta trésorerie et devra être remboursée à l'échéance.",
    icon: "users",
    Icon: ArrowDownLeft,
    color: "#F59E0B",
    actionLabel: "Rembourser",
    actionIcon: ArrowUpRight,
    payLabel: "Remboursement",
  },
  {
    id: "personal_lent" as const,
    label: "J'ai prêté",
    desc: "Somme donnée à un proche. Elle sort de ta trésorerie. Quand la personne te rembourse, ça revient en trésorerie.",
    icon: "hand-coins",
    Icon: ArrowUpRight,
    color: "#10B981",
    actionLabel: "Encaisser",
    actionIcon: ArrowDownLeft,
    payLabel: "Remboursement reçu",
  },
];

interface BudgetData {
  loans: Loan[];
  loanPayments: LoanPayment[];
  addLoan: (l: Omit<Loan, "id" | "created_at">, isExisting?: boolean, monthsPaid?: number, schedule?: import("@/lib/types").LoanScheduleInput[]) => Promise<Loan | false>;
  updateLoan: (id: number, u: Partial<Loan>) => Promise<void>;
  removeLoan: (id: number) => Promise<void>;
  addLoanPayment: (p: Omit<LoanPayment, "id" | "created_at">) => Promise<boolean>;
  updateLoanPayment: (id: number, u: Partial<Pick<LoanPayment, "amount" | "fees" | "date" | "time" | "notes">>) => Promise<boolean>;
  removeLoanPayment: (id: number) => Promise<void>;
  fetchSchedule: (loanId: number) => Promise<import("@/lib/types").LoanScheduleRow[]>;
  markSchedulePaid: (loanId: number, number: number, note?: string) => Promise<boolean>;
  markScheduleUnpaid: (loanId: number, number: number) => Promise<boolean>;
  monthLoanPayments: number;
  totalDebt: number;
  config: { salary?: number };
  salaries: number[];
  selectedMonth: number;
  selectedYear: number;
}

export default function LoansView({
  budget,
  showToast,
}: {
  budget: BudgetData;
  showToast: (m: string, t?: string) => void;
}) {
  const {
    loans, loanPayments, addLoan, removeLoan,
    addLoanPayment, updateLoanPayment, removeLoanPayment,
    fetchSchedule, markSchedulePaid, markScheduleUnpaid,
    monthLoanPayments, totalDebt, config, salaries, selectedMonth, selectedYear,
  } = budget;

  const [showPayModal, setShowPayModal] = useState<Loan | null>(null);
  const [editingPayment, setEditingPayment] = useState<{ payment: LoanPayment; loan: Loan } | null>(null);
  const [expandedLoan, setExpandedLoan] = useState<number | null>(null);
  const [payingScheduleId, setPayingScheduleId] = useState<number | null>(null);
  const [analysisLoanId, setAnalysisLoanId] = useState<number | null>(null);
  const [analysisSchedule, setAnalysisSchedule] = useState<import("@/lib/types").LoanScheduleRow[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const analysisRef = useRef<HTMLDivElement>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  const salary = (salaries[selectedMonth] ?? 0) || config.salary || 0;

  useEffect(() => {
    const viewId = searchParams.get("view");
    const payId = searchParams.get("pay");
    const payNumber = searchParams.get("number");
    if (viewId && loans.length > 0) {
      const id = parseInt(viewId, 10);
      const loan = loans.find((l) => l.id === id);
      if (loan && loan.type === "bank") {
        setAnalysisLoanId(id);
        router.replace("/loans", { scroll: false });
      }
    } else if (payId && loans.length > 0) {
      const id = parseInt(payId, 10);
      const loan = loans.find((l) => l.id === id);
      if (loan) {
        if (loan.type === "bank" && payNumber) {
          setAnalysisLoanId(id);
          router.replace("/loans", { scroll: false });
        } else {
          setShowPayModal(loan);
          setExpandedLoan(id);
          router.replace("/loans", { scroll: false });
        }
      }
    }
  }, [searchParams, loans, router]);

  useEffect(() => {
    if (!analysisLoanId) {
      setAnalysisSchedule([]);
      return;
    }
    let cancelled = false;
    setAnalysisLoading(true);
    fetchSchedule(analysisLoanId).then((s) => {
      if (!cancelled) {
        setAnalysisSchedule(s);
        setAnalysisLoading(false);
        setTimeout(() => analysisRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    });
    return () => { cancelled = true; };
  }, [analysisLoanId, fetchSchedule]);

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const [payForm, setPayForm] = useState({
    amount: "",
    fees: "",
    date: todayStr,
    time: nowTime,
    notes: "",
  });

  const [editPayForm, setEditPayForm] = useState({
    amount: "",
    fees: "",
    date: todayStr,
    time: nowTime,
    notes: "",
  });

  const activeLoans = useMemo(() => loans.filter((l) => l.status === "active"), [loans]);
  const completedLoans = useMemo(() => loans.filter((l) => l.status === "completed"), [loans]);

  const loanPaymentsMap = useMemo(() => {
    const map: Record<number, LoanPayment[]> = {};
    loanPayments.forEach((p) => {
      if (!map[p.loan_id]) map[p.loan_id] = [];
      map[p.loan_id].push(p);
    });
    return map;
  }, [loanPayments]);

  const totalLent = useMemo(
    () => loans.filter((l) => l.type === "personal_lent" && l.status === "active").reduce((s, l) => s + l.remaining_amount, 0),
    [loans]
  );

  const totalBorrowed = useMemo(
    () => loans.filter((l) => (l.type === "bank" || l.type === "personal_borrowed") && l.status === "active").reduce((s, l) => s + l.remaining_amount, 0),
    [loans]
  );

  const handleEditPayment = async () => {
    if (!editingPayment) return;
    const amt = Number(editPayForm.amount);
    if (!amt || amt <= 0) {
      showToast("Montant invalide", "error");
      return;
    }
    const ok = await updateLoanPayment(editingPayment.payment.id, {
      amount: amt,
      fees: Number(editPayForm.fees) || 0,
      date: editPayForm.date,
      time: editPayForm.time,
      notes: editPayForm.notes,
    });
    if (ok) {
      showToast("Paiement modifié");
      setEditingPayment(null);
    }
  };

  const handlePay = async () => {
    if (!showPayModal || !payForm.amount || Number(payForm.amount) <= 0) {
      showToast("Montant requis", "error");
      return;
    }
    const ok = await addLoanPayment({
      loan_id: showPayModal.id,
      amount: Number(payForm.amount),
      fees: Number(payForm.fees) || 0,
      date: payForm.date,
      time: payForm.time,
      notes: payForm.notes,
    });
    if (ok) {
      const ti = typeInfo(showPayModal.type);
      showToast(`${ti.payLabel} de ${formatCFA(Number(payForm.amount))} enregistré`);
      setShowPayModal(null);
    }
  };

  const handlePaySchedule = async (loan: Loan) => {
    if (loan.type !== "bank") return;
    setPayingScheduleId(loan.id);
    try {
      const schedule = await fetchSchedule(loan.id);
      const today = new Date().toISOString().split("T")[0];
      const nextDueRow =
        schedule.find((s) => s.status !== "paid" && s.due_date >= today) ||
        schedule.find((s) => s.status === "overdue" || s.status === "pending");
      if (!nextDueRow) {
        showToast("Aucune échéance à payer ce mois", "info");
        return;
      }
      const ok = await markSchedulePaid(loan.id, nextDueRow.number);
      if (ok) {
        showToast(`Échéance #${nextDueRow.number} payée !`);
      } else {
        showToast("Erreur lors du paiement", "error");
      }
    } catch {
      showToast("Erreur", "error");
    } finally {
      setPayingScheduleId(null);
    }
  };

  const getDueStatus = (loan: Loan): "ok" | "warn" | "overdue" => {
    if (!loan.next_due_date) return "ok";
    const due = new Date(loan.next_due_date);
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (diff < 0) return "overdue";
    if (diff < 7) return "warn";
    return "ok";
  };

  const typeInfo = (type: Loan["type"]) => LOAN_TYPES.find((t) => t.id === type) || LOAN_TYPES[0];

  return (
    <div className="animate-slide-up">
      <div className="flex justify-between items-start mb-5 lg:mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold">Prêts & Dettes</h1>
          <p className="text-slate-500 text-xs lg:text-sm mt-0.5">
            {activeLoans.length} en cours
          </p>
        </div>
        <button
          onClick={() => router.push("/loans/new")}
          className="btn-primary px-4 py-2.5 rounded-xl text-xs lg:text-sm font-semibold flex items-center gap-1.5 shrink-0"
        >
          <Plus size={16} /> Nouveau
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 lg:gap-4 mb-5 lg:mb-6">
        <div className="glass rounded-xl lg:rounded-2xl p-3 lg:p-5">
          <div className="text-[9px] lg:text-[11px] text-slate-500">Je dois</div>
          <div className="font-mono text-sm lg:text-xl font-bold text-red-400 mt-0.5">{formatCFA(totalBorrowed)}</div>
        </div>
        <div className="glass rounded-xl lg:rounded-2xl p-3 lg:p-5">
          <div className="text-[9px] lg:text-[11px] text-slate-500">On me doit</div>
          <div className="font-mono text-sm lg:text-xl font-bold text-emerald-400 mt-0.5">{formatCFA(totalLent)}</div>
        </div>
        <div className="glass rounded-xl lg:rounded-2xl p-3 lg:p-5">
          <div className="text-[9px] lg:text-[11px] text-slate-500">Flux ce mois</div>
          <div className="font-mono text-sm lg:text-xl font-bold text-emerald-400 mt-0.5">{formatCFA(monthLoanPayments)}</div>
        </div>
      </div>

      {/* Active loans */}
      {activeLoans.length === 0 && completedLoans.length === 0 ? (
        <div className="glass-strong rounded-2xl py-16 text-center text-slate-500">
          <Banknote size={40} className="mx-auto mb-3 text-slate-600" />
          <p className="text-sm">Aucun prêt ou dette enregistré</p>
          <p className="text-xs mt-1 text-slate-600">Ajoute un prêt bancaire ou personnel</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeLoans.map((loan) => {
            const ti = typeInfo(loan.type);
            const pct = loan.total_amount > 0 ? ((loan.total_amount - loan.remaining_amount) / loan.total_amount) * 100 : 0;
            const dueStatus = getDueStatus(loan);
            const payments = loanPaymentsMap[loan.id] || [];
            const isExpanded = expandedLoan === loan.id;
            const remainColor = loan.type === "personal_lent" ? "text-emerald-300" : "text-red-300";

            return (
              <div key={loan.id} className="glass-strong rounded-2xl overflow-hidden">
                <div className="p-4 lg:p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: ti.color + "22" }}>
                      <Icon name={ti.icon} size={20} style={{ color: ti.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm lg:text-base font-semibold truncate">{loan.label}</span>
                        {dueStatus === "overdue" && <AlertTriangle size={14} className="text-red-400 shrink-0" />}
                        {dueStatus === "warn" && <CircleAlert size={14} className="text-amber-400 shrink-0" />}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] lg:text-xs text-slate-500">
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-medium" style={{ background: ti.color + "22", color: ti.color }}>
                          {ti.label}
                        </span>
                        {loan.lender_borrower && (
                          <span>
                            {loan.type === "personal_lent" ? "Prêté à" : loan.type === "personal_borrowed" ? "Emprunté de" : "Banque:"} {loan.lender_borrower}
                          </span>
                        )}
                        {loan.interest_rate > 0 && <span>{loan.interest_rate}% intérêt</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-mono text-sm lg:text-base font-bold ${remainColor}`}>
                        {formatCFA(loan.remaining_amount)}
                      </div>
                      <div className="text-[9px] lg:text-[10px] text-slate-500">
                        / {formatCFA(loan.total_amount)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <AnimatedProgressBar
                      value={loan.total_amount - loan.remaining_amount}
                      max={loan.total_amount}
                      duration={0.6}
                      className="h-1.5"
                      gradient={`linear-gradient(90deg, ${ti.color}, ${ti.color}aa)`}
                    />
                    <div className="flex justify-between mt-1 text-[9px] lg:text-[10px] text-slate-500">
                      <span>{pct.toFixed(0)}% {loan.type === "personal_lent" ? "récupéré" : "remboursé"}</span>
                      {loan.next_due_date && (
                        <span className={dueStatus === "overdue" ? "text-red-400 font-medium" : dueStatus === "warn" ? "text-amber-400" : ""}>
                          Échéance: {new Date(loan.next_due_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    {loan.type === "bank" && (
                      <button
                        onClick={() => setAnalysisLoanId(loan.id)}
                        className="py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30"
                      >
                        <BarChart3 size={14} /> Analyse
                      </button>
                    )}
                    {loan.type === "bank" ? (
                      <button
                        onClick={() => handlePaySchedule(loan)}
                        disabled={payingScheduleId === loan.id}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                        style={{ background: ti.color + "22", color: ti.color }}
                      >
                        {payingScheduleId === loan.id ? (
                          <>
                            <Loader2 size={14} className="animate-spin" /> Paiement...
                          </>
                        ) : (
                          <>
                            <Check size={14} /> Payer l'échéance du mois
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          const n = new Date();
                          setPayForm({
                            amount: String(loan.monthly_payment || ""),
                            fees: "",
                            date: n.toISOString().split("T")[0],
                            time: `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`,
                            notes: "",
                          });
                          setShowPayModal(loan);
                        }}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        style={{ background: ti.color + "22", color: ti.color }}
                      >
                        <ti.actionIcon size={14} /> {ti.actionLabel}
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedLoan(isExpanded ? null : loan.id)}
                      className="px-3 py-2 rounded-xl bg-white/5 text-slate-400 hover:text-slate-300 transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button
                      onClick={async () => { await removeLoan(loan.id); showToast("Supprimé", "info"); }}
                      className="px-3 py-2 rounded-xl bg-white/5 text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-white/5 px-4 lg:px-5 py-3 bg-white/[0.01]">
                    <div className="text-[10px] lg:text-xs font-semibold text-slate-400 mb-2">
                      Historique ({payments.length})
                    </div>
                    {payments.length === 0 ? (
                      <p className="text-[10px] text-slate-600 py-2">Aucun paiement enregistré</p>
                    ) : (
                      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                        {payments.map((p) => (
                          <div key={p.id} className="flex items-center gap-2 text-[10px] lg:text-xs group">
                            <Clock size={10} className="text-slate-600 shrink-0" />
                            <span className="text-slate-500">{p.date} {p.time !== "00:00" && `à ${p.time}`}</span>
                            <span className="font-mono font-medium" style={{ color: ti.color }}>
                              {loan.type === "personal_lent" ? "+" : "-"}{formatCFA(p.amount)}
                            </span>
                            {p.fees > 0 && <span className="text-red-400/70">+{formatCFA(p.fees)} frais</span>}
                            {p.notes && <span className="text-slate-600 truncate">— {p.notes}</span>}
                            <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setEditPayForm({
                                    amount: String(p.amount),
                                    fees: String(p.fees || ""),
                                    date: p.date,
                                    time: p.time || "00:00",
                                    notes: p.notes || "",
                                  });
                                  setEditingPayment({ payment: p, loan });
                                }}
                                className="text-slate-700 hover:text-emerald-400 transition-colors p-0.5"
                                title="Modifier"
                              >
                                <Pencil size={10} />
                              </button>
                              <button
                                onClick={async () => { await removeLoanPayment(p.id); showToast("Paiement supprimé", "info"); }}
                                className="text-slate-700 hover:text-red-400 transition-colors p-0.5"
                                title="Supprimer"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {(loan.monthly_payment > 0 || loan.fees > 0) && (
                      <div className="flex gap-2 mt-3 pt-2 border-t border-white/5">
                        {loan.monthly_payment > 0 && (
                          <span className="text-[9px] text-slate-500">Mensualité: {formatCFA(loan.monthly_payment)}</span>
                        )}
                        {loan.fees > 0 && (
                          <span className="text-[9px] text-slate-500">Frais: {formatCFA(loan.fees)}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {completedLoans.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-2">
                <CircleCheck size={14} className="text-emerald-400" /> Soldés ({completedLoans.length})
              </h3>
              <div className="space-y-2">
                {completedLoans.map((loan) => {
                  const ti = typeInfo(loan.type);
                  return (
                    <div key={loan.id} className="glass rounded-xl p-3 flex items-center gap-3 opacity-60">
                      <Icon name={ti.icon} size={16} style={{ color: ti.color }} />
                      <span className="text-xs flex-1 truncate">{loan.label}</span>
                      <span className="font-mono text-xs text-slate-500 line-through">{formatCFA(loan.total_amount)}</span>
                      <CircleCheck size={14} className="text-emerald-400" />
                      <button onClick={async () => { await removeLoan(loan.id); showToast("Supprimé", "info"); }}
                        className="text-slate-600 hover:text-red-400 transition-colors p-1">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Analyse du prêt (en bas de page) ── */}
          {analysisLoanId && (() => {
            const loan = loans.find((l) => l.id === analysisLoanId);
            if (!loan) return null;
            const handleMarkPaid = async (num: number, note?: string) => {
              const ok = await markSchedulePaid(loan.id, num, note);
              if (ok) {
                showToast("Échéance marquée comme payée !");
                const s = await fetchSchedule(loan.id);
                setAnalysisSchedule(s);
              } else {
                showToast("Erreur", "error");
              }
            };
            const handleMarkUnpaid = async (num: number) => {
              const ok = await markScheduleUnpaid(loan.id, num);
              if (ok) {
                showToast("Paiement annulé");
                const s = await fetchSchedule(loan.id);
                setAnalysisSchedule(s);
              } else {
                showToast("Erreur", "error");
              }
            };
            return (
              <div ref={analysisRef} className="mt-8 pt-6 border-t border-white/10">
                <h2 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <BarChart3 size={18} className="text-indigo-400" />
                  Analyse — {loan.label}
                </h2>
                {analysisLoading ? (
                  <div className="glass rounded-2xl p-12 text-center text-slate-500">Chargement...</div>
                ) : (
                  <div className="glass rounded-2xl p-4 lg:p-6">
                    <LoanAnalysis
                      loan={loan}
                      schedule={analysisSchedule}
                      salary={salary}
                      onMarkPaid={handleMarkPaid}
                      onMarkUnpaid={handleMarkUnpaid}
                      onClose={() => {
                        setAnalysisLoanId(null);
                        setAnalysisSchedule([]);
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Modal — Payer / Encaisser ── */}
      {showPayModal && (() => {
        const ti = typeInfo(showPayModal.type);
        const isPayingBack = showPayModal.type !== "personal_lent";
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
            onClick={() => setShowPayModal(null)}>
            <div className="popup-panel w-full sm:w-[480px] rounded-t-2xl sm:rounded-2xl p-6 lg:p-8 animate-slide-up min-h-[85dvh] sm:min-h-0 max-h-[95dvh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-base font-bold flex items-center gap-2">
                  <ti.actionIcon size={18} style={{ color: ti.color }} />
                  {ti.actionLabel} — {showPayModal.label}
                </h2>
                <button onClick={() => setShowPayModal(null)} className="text-slate-400 p-1"><X size={20} /></button>
              </div>
              <div className="grid gap-4">
                <div className="glass rounded-xl p-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span>Reste: <span className={`font-mono font-medium ${isPayingBack ? "text-red-400" : "text-emerald-400"}`}>{formatCFA(showPayModal.remaining_amount)} FCFA</span></span>
                  {showPayModal.monthly_payment > 0 && <span>Mensualité: <span className="font-mono font-medium text-emerald-400">{formatCFA(showPayModal.monthly_payment)}</span></span>}
                  {showPayModal.lender_borrower && <span>{isPayingBack ? "À:" : "De:"} <span className="text-slate-300">{showPayModal.lender_borrower}</span></span>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Date</label>
                    <input type="date" className="input-field" value={payForm.date}
                      onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Heure</label>
                    <input type="time" className="input-field" value={payForm.time}
                      onChange={(e) => setPayForm({ ...payForm, time: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Montant (FCFA)</label>
                    <input type="number" className="input-field font-mono" placeholder="0"
                      value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
                  </div>
                  {showPayModal.type === "bank" ? (
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Frais (FCFA)</label>
                      <input type="number" className="input-field font-mono" placeholder="0"
                        value={payForm.fees} onChange={(e) => setPayForm({ ...payForm, fees: e.target.value })} />
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Notes</label>
                      <input className="input-field" placeholder="Espèces, mobile money..."
                        value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
                    </div>
                  )}
                </div>
                {showPayModal.type === "bank" && (
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Notes (optionnel)</label>
                    <input className="input-field" placeholder="Virement, prélèvement..."
                      value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
                  </div>
                )}
                {payForm.amount && Number(payForm.amount) > 0 && (
                  <div className={`p-3 rounded-xl flex items-center gap-2 text-xs ${
                    isPayingBack ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"
                  }`}>
                    {isPayingBack ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                    <span className="font-medium">
                      {isPayingBack
                        ? `${formatCFA(Number(payForm.amount))} sortira de ta trésorerie`
                        : `${formatCFA(Number(payForm.amount))} entrera dans ta trésorerie`
                      }
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowPayModal(null)} className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm">Annuler</button>
                <button onClick={handlePay} className="btn-primary flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5">
                  <Check size={16} /> {ti.payLabel}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal — Modifier paiement ── */}
      {editingPayment && (() => {
        const { payment, loan } = editingPayment;
        const ti = typeInfo(loan.type);
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
            onClick={() => setEditingPayment(null)}>
            <div className="popup-panel w-full sm:w-[420px] rounded-t-2xl sm:rounded-2xl p-6 animate-slide-up"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Pencil size={18} style={{ color: ti.color }} />
                  Modifier le remboursement — {loan.label}
                </h2>
                <button onClick={() => setEditingPayment(null)} className="text-slate-400 p-1"><X size={20} /></button>
              </div>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Date</label>
                    <input type="date" className="input-field" value={editPayForm.date}
                      onChange={(e) => setEditPayForm({ ...editPayForm, date: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Heure</label>
                    <input type="time" className="input-field" value={editPayForm.time}
                      onChange={(e) => setEditPayForm({ ...editPayForm, time: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Montant (FCFA)</label>
                    <input type="number" className="input-field font-mono" placeholder="0"
                      value={editPayForm.amount} onChange={(e) => setEditPayForm({ ...editPayForm, amount: e.target.value })} />
                  </div>
                  {loan.type === "bank" ? (
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Frais (FCFA)</label>
                      <input type="number" className="input-field font-mono" placeholder="0"
                        value={editPayForm.fees} onChange={(e) => setEditPayForm({ ...editPayForm, fees: e.target.value })} />
                    </div>
                  ) : null}
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Notes (optionnel)</label>
                  <input className="input-field" placeholder="Virement, prélèvement..."
                    value={editPayForm.notes} onChange={(e) => setEditPayForm({ ...editPayForm, notes: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setEditingPayment(null)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 text-sm">Annuler</button>
                <button onClick={handleEditPayment} className="btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5">
                  <Check size={14} /> Enregistrer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
