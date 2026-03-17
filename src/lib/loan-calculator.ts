/**
 * Génère automatiquement le tableau d'amortissement complet.
 * Type CONSTANT (comme les prêts SGCI) : mensualité fixe.
 */
import type { LoanScheduleInput } from "./types";

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Génère les dates d'échéance à partir de la première date et du jour de paiement */
export function generatePaymentDates(firstDate: string, count: number, paymentDay: number): string[] {
  const dates: string[] = [];
  const d = new Date(firstDate + "T12:00:00");
  for (let i = 0; i < count; i++) {
    const month = d.getMonth() + i;
    const year = d.getFullYear() + Math.floor(month / 12);
    const monthNorm = ((month % 12) + 12) % 12;
    const daysInMonth = getDaysInMonth(year, monthNorm);
    const day = Math.min(paymentDay, daysInMonth);
    dates.push(`${year}-${String(monthNorm + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return dates;
}

export function generateAmortizationSchedule(params: {
  totalAmount: number;
  annualRate: number;
  months: number;
  startDate: string;
  firstPaymentDate: string;
  paymentDay: number;
  insuranceRate?: number;
  taxRate?: number;
  feesAmount?: number;
  feeTaxRate?: number;
  alreadyPaid?: number;
}): LoanScheduleInput[] {
  const {
    totalAmount,
    annualRate,
    months,
    firstPaymentDate,
    paymentDay,
    insuranceRate = 0,
    taxRate = 0,
    feesAmount = 0,
    feeTaxRate = 10,
    alreadyPaid = 0,
  } = params;

  const r = annualRate / 100 / 12;
  const n = months;
  const monthlyPrincipalInterest = r > 0
    ? (totalAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    : totalAmount / n;
  const monthlyInsurance = (totalAmount * (insuranceRate / 100)) / 12;

  const dates = generatePaymentDates(firstPaymentDate, n, paymentDay);
  const rows: LoanScheduleInput[] = [];
  let balance = totalAmount;

  for (let i = 0; i < n; i++) {
    const interest = Math.round(balance * r);
    let principal = Math.round(monthlyPrincipalInterest - balance * r);
    if (i === n - 1) principal = balance;
    principal = Math.min(principal, balance);
    const insurance = Math.round(monthlyInsurance);
    const taxInterest = Math.round(interest * (taxRate / 100));
    const taxInsurance = Math.round(insurance * (taxRate / 100));
    const fees = i === 0 && feesAmount > 0 ? Math.round(feesAmount * (1 + feeTaxRate / 100)) : 0;
    const totalPayment = principal + interest + insurance + taxInterest + taxInsurance + fees;
    balance = Math.max(0, balance - principal);

    rows.push({
      number: i + 1,
      due_date: dates[i],
      principal,
      interest,
      insurance,
      tax_interest: taxInterest,
      tax_insurance: taxInsurance,
      fees,
      total_payment: totalPayment,
      remaining_balance: balance,
      status: i < alreadyPaid ? "paid" : "pending",
    });
  }

  return rows;
}

export function calculateLoanStats(
  schedule: { total_payment: number; principal: number; interest: number; insurance: number; tax_interest: number; tax_insurance: number; fees: number; remaining_balance: number; due_date: string; status: string }[],
  loan: { total_amount: number; monthly_payment: number },
  salary: number
): {
  totalBorrowed: number;
  totalCost: number;
  totalInterest: number;
  totalInsurance: number;
  totalTaxes: number;
  totalFees: number;
  totalRepaid: number;
  remainingBalance: number;
  paidCount: number;
  totalCount: number;
  progressPercent: number;
  monthlyPayment: number;
  nextDueDate: string | null;
  nextDueAmount: number;
  endDate: string;
  debtRatio: number;
  daysUntilNextDue: number;
  overdueCount: number;
} {
  const today = new Date().toISOString().split("T")[0];
  const paid = schedule.filter((s) => s.status === "paid");
  const pending = schedule.filter((s) => s.status !== "paid");
  const overdue = schedule.filter((s) => s.status === "overdue" || (s.status === "pending" && s.due_date < today));
  const nextDue = pending.find((s) => s.due_date >= today) || pending[0];

  const totalInterest = schedule.reduce((s, r) => s + r.interest, 0);
  const totalInsurance = schedule.reduce((s, r) => s + r.insurance, 0);
  const totalTaxes = schedule.reduce((s, r) => s + r.tax_interest + r.tax_insurance, 0);
  const totalFees = schedule.reduce((s, r) => s + r.fees, 0);
  const totalRepaid = paid.reduce((s, r) => s + r.total_payment, 0);
  const lastPaid = paid.length > 0 ? paid[paid.length - 1] : null;
  const remainingBalance = lastPaid ? lastPaid.remaining_balance : loan.total_amount;
  const lastRow = schedule[schedule.length - 1];
  const capitalRepaid = paid.reduce((s, r) => s + r.principal, 0);

  const daysUntilNextDue = nextDue
    ? Math.ceil((new Date(nextDue.due_date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    totalBorrowed: loan.total_amount,
    totalCost: totalInterest + totalInsurance + totalTaxes + totalFees,
    totalInterest,
    totalInsurance,
    totalTaxes,
    totalFees,
    totalRepaid,
    remainingBalance,
    paidCount: paid.length,
    totalCount: schedule.length,
    progressPercent: schedule.length > 0 ? (capitalRepaid / loan.total_amount) * 100 : 0,
    monthlyPayment: loan.monthly_payment,
    nextDueDate: nextDue?.due_date ?? null,
    nextDueAmount: nextDue?.total_payment ?? 0,
    endDate: lastRow?.due_date ?? "",
    debtRatio: salary > 0 ? (loan.monthly_payment / salary) * 100 : 0,
    daysUntilNextDue,
    overdueCount: overdue.length,
  };
}

export function simulateEarlyRepayment(params: {
  remainingBalance: number;
  annualRate: number;
  currentMonthly: number;
  newMonthly: number;
  insuranceRate?: number;
  taxRate?: number;
}): {
  newDuration: number;
  savedInterest: number;
  savedMonths: number;
  newEndDate: string;
} {
  const { remainingBalance, annualRate, currentMonthly, newMonthly } = params;
  const r = annualRate / 100 / 12;
  if (r <= 0 || newMonthly <= 0) {
    return { newDuration: 0, savedInterest: 0, savedMonths: 0, newEndDate: "" };
  }
  const nCurrent = Math.ceil(Math.log(currentMonthly / (currentMonthly - remainingBalance * r)) / Math.log(1 + r));
  const nNew = Math.ceil(Math.log(newMonthly / (newMonthly - remainingBalance * r)) / Math.log(1 + r));
  const totalInterestCurrent = nCurrent * currentMonthly - remainingBalance;
  const totalInterestNew = nNew * newMonthly - remainingBalance;
  const savedInterest = Math.max(0, totalInterestCurrent - totalInterestNew);
  const savedMonths = Math.max(0, nCurrent - nNew);
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + nNew);
  return {
    newDuration: nNew,
    savedInterest,
    savedMonths,
    newEndDate: endDate.toISOString().split("T")[0],
  };
}
