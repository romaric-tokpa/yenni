"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatCFA, accountHasActiveOutgoingLock, accountTypeLabel, isBankTreasuryDebitAccount } from "@/lib/constants";
import { useBudgetContext } from "@/contexts/BudgetContext";
import { generateAmortizationSchedule } from "@/lib/loan-calculator";
import { Loan } from "@/lib/types";
import Icon from "./ui/Icon";
import {
  ArrowLeft,
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Banknote,
  Percent,
  Calendar,
  FileText,
  ChevronRight,
} from "lucide-react";

const LOAN_TYPES = [
  {
    id: "bank" as const,
    label: "Prêt bancaire",
    desc: "Crédit auprès d'une banque ou organisme",
    icon: "landmark",
    Icon: Building2,
    color: "#3B82F6",
  },
  {
    id: "personal_borrowed" as const,
    label: "J'ai emprunté",
    desc: "Somme reçue d'un ami ou de la famille",
    icon: "users",
    Icon: ArrowDownLeft,
    color: "#F59E0B",
  },
  {
    id: "personal_lent" as const,
    label: "J'ai prêté",
    desc: "Somme donnée à un proche",
    icon: "hand-coins",
    Icon: ArrowUpRight,
    color: "#10B981",
  },
];

interface BudgetData {
  addLoan: (l: Omit<Loan, "id" | "created_at">, isExisting?: boolean, monthsPaid?: number, schedule?: import("@/lib/types").LoanScheduleInput[]) => Promise<Loan | false>;
  updateLoan?: (id: number, u: Partial<Loan>) => Promise<void>;
  regenerateLoanSchedule?: (loanId: number) => Promise<boolean>;
}

export default function LoanFormView({
  budget,
  showToast,
  loan: initialLoan,
}: {
  budget: BudgetData;
  showToast: (m: string, t?: string) => void;
  loan?: Loan;
}) {
  const { addLoan, updateLoan, regenerateLoanSchedule } = budget;
  const { accountsWithBalance } = useBudgetContext();
  const isEdit = !!initialLoan;
  const router = useRouter();
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const [type, setType] = useState<Loan["type"]>("bank");
  const [form, setForm] = useState({
    label: "",
    lender_borrower: "",
    bank_name: "",
    agency: "",
    loan_number: "",
    total_amount: "",
    interest_rate: "",
    insurance_rate: "",
    tax_rate: "",
    fees_amount: "",
    fees: "",
    monthly_payment: "",
    total_payments: "",
    start_date: todayStr,
    end_date: "",
    next_due_date: "",
    first_payment_date: todayStr,
    payment_day: "25",
    notes: "",
    isExisting: false,
    months_paid: "",
  });
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /** Comptes bancaires trésorerie utilisables pour prélèvement d’échéances (hors ép. bloquée). */
  const bankTreasuryAccounts = useMemo(
    () =>
      accountsWithBalance.filter(
        (a) =>
          !a.is_archived &&
          isBankTreasuryDebitAccount(a.kind) &&
          !accountHasActiveOutgoingLock(a.kind, a.vault_unlocks_on)
      ),
    [accountsWithBalance]
  );

  const repaymentChoiceAccounts = useMemo(
    () =>
      accountsWithBalance.filter(
        (a) => !a.is_archived && !accountHasActiveOutgoingLock(a.kind, a.vault_unlocks_on)
      ),
    [accountsWithBalance]
  );

  const isBank = type === "bank";
  const isLent = type === "personal_lent";
  const typeInfo = LOAN_TYPES.find((t) => t.id === type) || LOAN_TYPES[0];

  useEffect(() => {
    if (initialLoan) {
      setType(initialLoan.type);
      setForm({
        label: initialLoan.label,
        lender_borrower: initialLoan.lender_borrower || "",
        bank_name: initialLoan.bank_name || "",
        agency: initialLoan.agency || "",
        loan_number: initialLoan.loan_number || "",
        total_amount: String(initialLoan.total_amount),
        interest_rate: String(initialLoan.interest_rate ?? ""),
        insurance_rate: String(initialLoan.insurance_rate ?? ""),
        tax_rate: String(initialLoan.tax_rate ?? ""),
        fees_amount: String(initialLoan.fees_amount ?? ""),
        fees: String(initialLoan.fees ?? ""),
        monthly_payment: String(initialLoan.monthly_payment ?? ""),
        total_payments: String(initialLoan.total_payments ?? ""),
        start_date: initialLoan.start_date || todayStr,
        end_date: initialLoan.end_date || "",
        next_due_date: initialLoan.next_due_date || "",
        first_payment_date: initialLoan.first_payment_date || initialLoan.start_date || todayStr,
        payment_day: String(initialLoan.payment_day ?? 25),
        notes: initialLoan.notes || "",
        isExisting: false,
        months_paid: "",
      });
      setPaymentAccountId(
        initialLoan.payment_account_id != null ? String(initialLoan.payment_account_id) : ""
      );
    }
  }, [initialLoan]);

  /** Prêts existants sans compte : pré-sélection si un seul compte éligible */
  useEffect(() => {
    if (!initialLoan) return;
    if (initialLoan.payment_account_id != null) return;
    if (initialLoan.type === "bank" && bankTreasuryAccounts.length === 1) {
      setPaymentAccountId(String(bankTreasuryAccounts[0].id));
    } else if (initialLoan.type !== "bank" && repaymentChoiceAccounts.length === 1) {
      setPaymentAccountId(String(repaymentChoiceAccounts[0].id));
    }
  }, [
    initialLoan?.id,
    initialLoan?.payment_account_id,
    initialLoan?.type,
    bankTreasuryAccounts,
    repaymentChoiceAccounts,
  ]);

  useEffect(() => {
    if (isEdit) return;
    if (type === "bank") {
      const first = bankTreasuryAccounts[0];
      setPaymentAccountId(first ? String(first.id) : "");
    } else {
      const first = repaymentChoiceAccounts[0];
      setPaymentAccountId(first ? String(first.id) : "");
    }
  }, [type, isEdit, bankTreasuryAccounts, repaymentChoiceAccounts]);

  const estimatedMonthly =
    Number(form.total_amount) > 0 &&
    Number(form.interest_rate) >= 0 &&
    Number(form.total_payments) > 0
      ? (() => {
          const r = Number(form.interest_rate) / 100 / 12;
          const n = Number(form.total_payments);
          const p = Number(form.total_amount);
          if (r <= 0) return p / n;
          return (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        })()
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveLabel = form.label || (isBank ? "" : form.lender_borrower);
    if (!effectiveLabel || !form.total_amount || Number(form.total_amount) <= 0) {
      showToast("Remplis les champs obligatoires", "error");
      return;
    }

    if (isEdit && initialLoan && updateLoan) {
      const amt = Number(form.total_amount);
      const payment = Number(form.monthly_payment) || 0;
      const totalPayments = Number(form.total_payments) || 0;
      const updates: Partial<Loan> = {
        label: effectiveLabel,
        lender_borrower: isBank ? (form.bank_name || form.lender_borrower) : form.lender_borrower,
        total_amount: amt,
        interest_rate: Number(form.interest_rate) || 0,
        fees: Number(form.fees) || 0,
        monthly_payment: payment,
        start_date: form.start_date,
        end_date: form.end_date,
        next_due_date: form.next_due_date,
        notes: form.notes,
      };
      if (isBank) {
        updates.bank_name = form.bank_name;
        updates.agency = form.agency;
        updates.loan_number = form.loan_number;
        updates.first_payment_date = form.first_payment_date;
        updates.payment_day = Number(form.payment_day) || 25;
        updates.total_payments = totalPayments;
        updates.insurance_rate = Number(form.insurance_rate) || 0;
        updates.tax_rate = Number(form.tax_rate) || 0;
        updates.fees_amount = Number(form.fees_amount) || 0;
        const bid = paymentAccountId ? parseInt(paymentAccountId, 10) : NaN;
        if (!Number.isFinite(bid) || !bankTreasuryAccounts.some((a) => a.id === bid)) {
          showToast("Choisis un compte bancaire (trésorerie) pour les échéances", "error");
          return;
        }
        updates.payment_account_id = bid;
      } else {
        const pid = paymentAccountId ? parseInt(paymentAccountId, 10) : NaN;
        if (!Number.isFinite(pid) || !repaymentChoiceAccounts.some((a) => a.id === pid)) {
          showToast("Choisis un compte pour les mouvements de trésorerie", "error");
          return;
        }
        updates.payment_account_id = pid;
      }
      setSubmitting(true);
      await updateLoan(initialLoan.id, updates);
      if (isBank && regenerateLoanSchedule && (updates.total_amount != null || updates.interest_rate != null || updates.total_payments != null || updates.start_date != null || updates.first_payment_date != null || updates.payment_day != null || updates.insurance_rate != null || updates.tax_rate != null || updates.fees_amount != null)) {
        const ok = await regenerateLoanSchedule(initialLoan.id);
        if (ok) showToast("Prêt et tableau d'amortissement mis à jour");
        else showToast("Prêt modifié (tableau inchangé)", "info");
      } else {
        showToast("Prêt modifié");
      }
      setSubmitting(false);
      router.push(`/loans?view=${initialLoan.id}`);
      return;
    }

    const monthsPaid = form.isExisting ? Math.max(0, Number(form.months_paid) || 0) : 0;
    const payment = Number(form.monthly_payment) || 0;
    const totalPayments = Number(form.total_payments) || 0;
    const amt = Number(form.total_amount);

    if (form.isExisting && monthsPaid > 0 && payment <= 0 && !isBank) {
      showToast("Renseigne le montant par échéance", "error");
      return;
    }

    let schedule: import("@/lib/types").LoanScheduleInput[] | undefined;
    if (isBank && totalPayments > 0 && form.first_payment_date) {
      const firstDate = form.first_payment_date || form.start_date;
      const paymentDay = Math.min(31, Math.max(1, Number(form.payment_day) || 25));
      const feesAmt = Number(form.fees_amount) || 0;
      schedule = generateAmortizationSchedule({
        totalAmount: amt,
        annualRate: Number(form.interest_rate) || 0,
        months: totalPayments,
        startDate: form.start_date,
        firstPaymentDate: firstDate,
        paymentDay,
        insuranceRate: Number(form.insurance_rate) || 0,
        taxRate: Number(form.tax_rate) || 0,
        feesAmount: feesAmt,
        alreadyPaid: monthsPaid + (feesAmt > 0 ? 1 : 0),
      });
    }

    const monthlyFromSchedule = schedule
      ? (schedule.find((r) => r.principal > 0)?.total_payment ?? schedule[0]?.total_payment ?? 0)
      : 0;

    const loanData: Omit<Loan, "id" | "created_at"> = {
      type,
      label: effectiveLabel,
      lender_borrower: isBank ? (form.bank_name || form.lender_borrower) : form.lender_borrower,
      total_amount: amt,
      remaining_amount: amt,
      interest_rate: Number(form.interest_rate) || 0,
      fees: Number(form.fees) || 0,
      monthly_payment: payment || monthlyFromSchedule,
      start_date: form.start_date,
      end_date: form.end_date,
      next_due_date: form.next_due_date,
      notes: form.notes,
      status: "active",
    };

    if (isBank) {
      (loanData as Loan).bank_name = form.bank_name;
      (loanData as Loan).agency = form.agency;
      (loanData as Loan).loan_number = form.loan_number;
      (loanData as Loan).first_payment_date = form.first_payment_date;
      (loanData as Loan).payment_day = Number(form.payment_day) || 25;
      (loanData as Loan).total_payments = totalPayments;
      (loanData as Loan).insurance_rate = Number(form.insurance_rate) || 0;
      (loanData as Loan).tax_rate = Number(form.tax_rate) || 0;
      (loanData as Loan).fees_amount = Number(form.fees_amount) || 0;
    }

    const payAccNew = paymentAccountId ? parseInt(paymentAccountId, 10) : NaN;
    if (isBank) {
      if (!Number.isFinite(payAccNew) || !bankTreasuryAccounts.some((a) => a.id === payAccNew)) {
        showToast("Choisis un compte bancaire (trésorerie) pour les échéances", "error");
        return;
      }
      (loanData as Loan).payment_account_id = payAccNew;
    } else {
      if (!Number.isFinite(payAccNew) || !repaymentChoiceAccounts.some((a) => a.id === payAccNew)) {
        showToast("Choisis un compte pour les mouvements de trésorerie", "error");
        return;
      }
      (loanData as Loan).payment_account_id = payAccNew;
    }

    setSubmitting(true);
    const result = await addLoan(loanData, form.isExisting, monthsPaid, schedule);
    setSubmitting(false);

    if (result) {
      if (schedule && schedule.length > 0) {
        showToast(`Prêt créé avec ${schedule.length} échéances planifiées`);
        router.push(`/loans?view=${result.id}`);
      } else {
        showToast(
          form.isExisting
            ? `Prêt importé avec ${monthsPaid} échéance${monthsPaid > 1 ? "s" : ""} historiques`
            : isLent
              ? "Prêt enregistré"
              : "Emprunt enregistré"
        );
        router.push("/loans");
      }
    }
  };

  const Section = ({
    title,
    icon: IconEl,
    children,
  }: {
    title: string;
    icon: React.ElementType;
    children: React.ReactNode;
  }) => (
    <section className="glass rounded-2xl p-5 lg:p-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-4">
        <IconEl size={18} className="text-emerald-400" />
        {title}
      </h3>
      {children}
    </section>
  );

  const Field = ({
    label,
    optional,
    children,
  }: {
    label: string;
    optional?: boolean;
    children: React.ReactNode;
  }) => (
    <div className="mb-4 last:mb-0">
      <label className="block text-xs font-medium text-slate-400 mb-1.5">
        {label}
        {optional && <span className="text-slate-600 ml-1">(optionnel)</span>}
      </label>
      {children}
    </div>
  );

  const inputClass = "input-field w-full text-sm py-2.5";

  return (
    <div className="animate-slide-up max-w-2xl mx-auto pb-12">
      <header className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 transition-colors"
          aria-label="Retour"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold">{isEdit ? "Modifier le prêt" : "Nouveau prêt"}</h1>
          <p className="text-xs text-slate-500">
            {isEdit ? "Modifie les informations du prêt" : "Ajoute un prêt bancaire ou personnel"}
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type de prêt */}
        <Section title="Type de prêt" icon={Banknote}>
          <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${isEdit ? "opacity-60 pointer-events-none" : ""}`}>
            {LOAN_TYPES.map((t) => {
              const sel = type === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id)}
                  className={`p-4 rounded-xl text-left transition-all border-2 ${
                    sel ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/5 bg-white/[0.02] hover:bg-white/5"
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                    style={{ background: t.color + "22" }}
                  >
                    <Icon name={t.icon} size={20} style={{ color: t.color }} />
                  </div>
                  <div className="font-semibold text-sm" style={{ color: sel ? t.color : "#e2e8f0" }}>
                    {t.label}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{t.desc}</div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Informations du prêt */}
        <Section title="Informations du prêt" icon={FileText}>
          <div className="grid gap-4 sm:grid-cols-2">
            {isBank ? (
              <>
                <Field label="Nom du prêt">
                  <input
                    className={inputClass}
                    placeholder="PPO Moyen Terme SGCI"
                    value={form.label}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  />
                </Field>
                <Field label="Banque">
                  <input
                    className={inputClass}
                    placeholder="Société Générale CI"
                    value={form.bank_name}
                    onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
                  />
                </Field>
                <Field label="Agence" optional>
                  <input
                    className={inputClass}
                    placeholder="Riviera Palmeraie"
                    value={form.agency}
                    onChange={(e) => setForm((f) => ({ ...f, agency: e.target.value }))}
                  />
                </Field>
                <Field label="N° de prêt" optional>
                  <input
                    className={inputClass}
                    placeholder="101848"
                    value={form.loan_number}
                    onChange={(e) => setForm((f) => ({ ...f, loan_number: e.target.value }))}
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label={isLent ? "Prêté à" : "Emprunté de"}>
                  <input
                    className={inputClass}
                    placeholder="Ali, Marie..."
                    value={form.lender_borrower}
                    onChange={(e) => setForm((f) => ({ ...f, lender_borrower: e.target.value }))}
                  />
                </Field>
                <Field label="Intitulé" optional>
                  <input
                    className={inputClass}
                    placeholder="Motif du prêt (ou laisse vide si tu as rempli ci-dessus)"
                    value={form.label}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  />
                </Field>
              </>
            )}
          </div>
        </Section>

        {/* Compte trésorerie */}
        <Section title="Compte trésorerie" icon={Banknote}>
          {isBank ? (
            <>
              <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                Chaque échéance est une <strong>dépense</strong> débitée sur le{" "}
                <strong>compte bancaire</strong> de ta trésorerie choisi (courant, épargne non bloquée, etc. — pas
                d&apos;épargne bloquée, ni coffre, ni espèces / mobile money).
              </p>
              <Field label="Compte bancaire (trésorerie) — prélèvement des mensualités">
                <select
                  className={inputClass}
                  value={paymentAccountId}
                  onChange={(e) => setPaymentAccountId(e.target.value)}
                >
                  <option value="">— Choisir un compte —</option>
                  {bankTreasuryAccounts.map((a) => (
                    <option key={a.id} value={String(a.id)}>
                      {a.name} · {accountTypeLabel(a.kind, a.subtype, a.institution_name)}
                    </option>
                  ))}
                </select>
                {bankTreasuryAccounts.length === 0 && (
                  <p className="text-amber-400 text-[11px] mt-2">
                    Aucun compte bancaire : ajoute-en un dans <strong>Réglages → Trésorerie</strong> (type banque).
                  </p>
                )}
              </Field>
            </>
          ) : isLent ? (
            <>
              <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                Le montant prêté est <strong>débité</strong> de ce compte à la création. Les encaissements
                utilisent ce compte par défaut (modifiable à chaque encaissement).
              </p>
              <Field label="Compte (sortie du prêt / encaissements par défaut)">
                <select
                  className={inputClass}
                  value={paymentAccountId}
                  onChange={(e) => setPaymentAccountId(e.target.value)}
                >
                  <option value="">— Choisir un compte —</option>
                  {repaymentChoiceAccounts.map((a) => (
                    <option key={a.id} value={String(a.id)}>
                      {a.name} · {accountTypeLabel(a.kind, a.subtype, a.institution_name)}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          ) : (
            <>
              <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                Chaque remboursement est une <strong>dépense</strong> sur le compte choisi (espèces, mobile
                money, compte courant, etc.). Les comptes coffre <strong>verrouillés</strong> ne sont pas proposés.
              </p>
              <Field label="Compte pour les remboursements">
                <select
                  className={inputClass}
                  value={paymentAccountId}
                  onChange={(e) => setPaymentAccountId(e.target.value)}
                >
                  <option value="">— Choisir un compte —</option>
                  {repaymentChoiceAccounts.map((a) => (
                    <option key={a.id} value={String(a.id)}>
                      {a.name} · {accountTypeLabel(a.kind, a.subtype, a.institution_name)}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
        </Section>

        {/* Conditions financières */}
        <Section title="Conditions financières" icon={Percent}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Montant (FCFA) *">
              <input
                type="number"
                className={`${inputClass} font-mono`}
                placeholder="4 500 000"
                value={form.total_amount}
                onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))}
              />
            </Field>
            {isBank ? (
              <>
                <Field label="Taux d'intérêt annuel (%) *">
                  <input
                    type="number"
                    step="0.1"
                    className={`${inputClass} font-mono`}
                    placeholder="7.5"
                    value={form.interest_rate}
                    onChange={(e) => setForm((f) => ({ ...f, interest_rate: e.target.value }))}
                  />
                </Field>
                <Field label="Nombre d'échéances (mois) *">
                  <input
                    type="number"
                    className={`${inputClass} font-mono`}
                    placeholder="60"
                    value={form.total_payments}
                    onChange={(e) => setForm((f) => ({ ...f, total_payments: e.target.value }))}
                  />
                </Field>
                <Field label="Mensualité (FCFA)">
                  <input
                    type="number"
                    className={`${inputClass} font-mono`}
                    placeholder="Auto-calculée"
                    value={form.monthly_payment}
                    onChange={(e) => setForm((f) => ({ ...f, monthly_payment: e.target.value }))}
                  />
                </Field>
                <Field label="Taux assurance (%)" optional>
                  <input
                    type="number"
                    step="0.1"
                    className={`${inputClass} font-mono`}
                    placeholder="1.1"
                    value={form.insurance_rate}
                    onChange={(e) => setForm((f) => ({ ...f, insurance_rate: e.target.value }))}
                  />
                </Field>
                <Field label="Taxe sur intérêts (%)" optional>
                  <input
                    type="number"
                    step="0.1"
                    className={`${inputClass} font-mono`}
                    placeholder="10"
                    value={form.tax_rate}
                    onChange={(e) => setForm((f) => ({ ...f, tax_rate: e.target.value }))}
                  />
                </Field>
                <Field label="Frais de dossier (FCFA)" optional>
                  <input
                    type="number"
                    className={`${inputClass} font-mono`}
                    placeholder="99 000"
                    value={form.fees_amount}
                    onChange={(e) => setForm((f) => ({ ...f, fees_amount: e.target.value }))}
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Payés à la date de mise en place (1ère échéance séparée, modèle SGBCI)
                  </span>
                </Field>
              </>
            ) : (
              <>
                <Field label="Montant par échéance">
                  <input
                    type="number"
                    className={`${inputClass} font-mono`}
                    placeholder="50 000"
                    value={form.monthly_payment}
                    onChange={(e) => setForm((f) => ({ ...f, monthly_payment: e.target.value }))}
                  />
                </Field>
              </>
            )}
          </div>
          {estimatedMonthly !== null && isBank && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-sm font-medium text-emerald-300">
                Mensualité estimée : <span className="font-mono">{formatCFA(Math.round(estimatedMonthly))} FCFA</span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Tu peux ajuster si la banque arrondit différemment</p>
            </div>
          )}
        </Section>

        {/* Dates */}
        <Section title="Dates" icon={Calendar}>
          {isBank ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Date de mise en place *">
                <input
                  type="date"
                  className={inputClass}
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </Field>
              <Field label="Date de 1ère échéance *">
                <input
                  type="date"
                  className={inputClass}
                  value={form.first_payment_date || form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, first_payment_date: e.target.value }))}
                />
              </Field>
              <Field label="Jour de paiement mensuel">
                <input
                  type="number"
                  min={1}
                  max={31}
                  className={`${inputClass} font-mono`}
                  placeholder="25"
                  value={form.payment_day}
                  onChange={(e) => setForm((f) => ({ ...f, payment_day: e.target.value }))}
                />
              </Field>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date">
                <input
                  type="date"
                  className={inputClass}
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </Field>
              <Field label="Échéance">
                <input
                  type="date"
                  className={inputClass}
                  value={form.next_due_date}
                  onChange={(e) => setForm((f) => ({ ...f, next_due_date: e.target.value }))}
                />
              </Field>
            </div>
          )}
        </Section>

        {/* Import prêt en cours */}
        {!isEdit && form.isExisting ? (
          <Section title="Import d'un prêt en cours" icon={ChevronRight}>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isExisting}
                  onChange={(e) => setForm((f) => ({ ...f, isExisting: e.target.checked, months_paid: "" }))}
                  className="rounded border-slate-600 bg-white/5 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-300">Prêt déjà en cours — aucune écriture comptable</span>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Échéances déjà payées">
                  <input
                    type="number"
                    className={`${inputClass} font-mono`}
                    placeholder="13"
                    value={form.months_paid}
                    onChange={(e) => setForm((f) => ({ ...f, months_paid: e.target.value }))}
                  />
                </Field>
                {!isBank && (
                  <Field label="Montant par échéance">
                    <input
                      type="number"
                      className={`${inputClass} font-mono`}
                      placeholder="50 000"
                      value={form.monthly_payment}
                      onChange={(e) => setForm((f) => ({ ...f, monthly_payment: e.target.value }))}
                    />
                  </Field>
                )}
                {isBank && Number(form.months_paid) > 0 && Number(form.total_payments) > 0 && (
                  <div className="flex items-end pb-2">
                    <p className="text-sm text-amber-300">
                      {Number(form.months_paid)} marquées payées, {Math.max(0, Number(form.total_payments) - Number(form.months_paid))} restantes
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Section>
        ) : !isEdit && ((isBank && Number(form.total_payments) > 0) || (!isBank && Number(form.total_amount) > 0)) ? (
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, isExisting: true }))}
            className="w-full p-4 rounded-2xl border border-dashed border-amber-500/30 text-amber-400/80 hover:bg-amber-500/5 text-sm transition-colors flex items-center justify-center gap-2"
          >
            <ChevronRight size={18} /> Importer un prêt déjà en cours
          </button>
        ) : null}

        {/* Notes */}
        <Section title="Notes" icon={FileText}>
          <Field label="Notes" optional>
            <textarea
              className={`${inputClass} min-h-[80px] resize-none`}
              placeholder="Détails, remarques..."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
            />
          </Field>
        </Section>

        {/* Résumé */}
        {form.total_amount && Number(form.total_amount) > 0 && (
          <div
            className={`p-4 rounded-2xl flex items-center gap-3 ${
              form.isExisting ? "bg-amber-500/10 border border-amber-500/20" : isLent ? "bg-red-500/10 border border-red-500/20" : "bg-emerald-500/10 border border-emerald-500/20"
            }`}
          >
            {form.isExisting ? (
              <Banknote size={24} className="text-amber-400 shrink-0" />
            ) : isLent ? (
              <ArrowUpRight size={24} className="text-red-400 shrink-0" />
            ) : (
              <ArrowDownLeft size={24} className="text-emerald-400 shrink-0" />
            )}
            <div>
              <p className="font-medium text-sm">
                {form.isExisting
                  ? "Suivi uniquement — aucun impact trésorerie"
                  : isLent
                    ? `${formatCFA(Number(form.total_amount))} sortira de ta trésorerie`
                    : `${formatCFA(Number(form.total_amount))} entrera dans ta trésorerie`}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 sticky bottom-4 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-3.5 rounded-xl border border-white/10 text-slate-400 font-medium hover:bg-white/5 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-3.5 rounded-xl btn-primary font-semibold flex items-center justify-center gap-2"
          >
            {submitting ? (
              "Enregistrement..."
            ) : (
              <>
                <Check size={18} /> Enregistrer
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
