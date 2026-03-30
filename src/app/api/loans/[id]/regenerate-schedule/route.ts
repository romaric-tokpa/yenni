import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { getSessionFromCookies } from "@/lib/auth";
import { getLoan, getLoanSchedule, saveLoanSchedule, updateLoan } from "@/lib/db";
import { generateAmortizationSchedule } from "@/lib/loan-calculator";
import type { LoanScheduleInput } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { id } = await params;
    const loanId = parseInt(id, 10);
    if (isNaN(loanId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const loan = await getLoan(loanId);
    if (!loan) return NextResponse.json({ error: "Prêt non trouvé" }, { status: 404 });

    if (loan.type !== "bank") {
      return NextResponse.json({ error: "Régénération uniquement pour prêts bancaires" }, { status: 400 });
    }

    const totalPayments = loan.total_payments ?? 0;
    if (totalPayments <= 0) {
      return NextResponse.json({ error: "Nombre d'échéances requis" }, { status: 400 });
    }

    const startDate = loan.start_date || new Date().toISOString().split("T")[0];
    const firstPaymentDate = loan.first_payment_date || startDate;
    const paymentDay = Math.min(31, Math.max(1, loan.payment_day ?? 25));
    const paidPayments = loan.paid_payments ?? 0;

    const oldSchedule = await getLoanSchedule(loanId);
    const oldByNumber = new Map(oldSchedule.map((r) => [r.number, r]));

    const monthly = loan.monthly_payment != null ? Math.round(Number(loan.monthly_payment)) : 0;
    const fixedRegularTotalPayment = monthly > 0 ? monthly : undefined;

    const generated = generateAmortizationSchedule({
      totalAmount: loan.total_amount,
      annualRate: loan.interest_rate ?? 0,
      months: totalPayments,
      startDate,
      firstPaymentDate,
      paymentDay,
      insuranceRate: loan.insurance_rate ?? 0,
      taxRate: loan.tax_rate ?? 0,
      feesAmount: loan.fees_amount ?? 0,
      alreadyPaid: paidPayments,
      fixedRegularTotalPayment,
    });

    const rows: LoanScheduleInput[] = generated.map((r) => {
      const oldRow = oldByNumber.get(r.number);
      const row: LoanScheduleInput = { ...r };
      if (oldRow?.status === "paid" && r.status === "paid") {
        row.paid_at = oldRow.paid_at ?? undefined;
        row.paid_amount = oldRow.paid_amount ?? oldRow.total_payment;
        row.expense_id = oldRow.expense_id ?? undefined;
      }
      return row;
    });

    await saveLoanSchedule(session.userId, loanId, rows);

    const paid = rows.filter((r) => r.status === "paid");
    const lastPaid = paid[paid.length - 1];
    const nextPending = rows.find((r) => r.status !== "paid");
    const lastRow = rows[rows.length - 1];

    await updateLoan(loanId, {
      remaining_amount: lastPaid?.remaining_balance ?? loan.remaining_amount,
      paid_payments: paid.length,
      next_due_date: nextPending?.due_date ?? "",
      monthly_payment: rows.find((r) => r.principal > 0)?.total_payment ?? loan.monthly_payment,
      end_date: lastRow?.due_date ?? loan.end_date,
    });

    return NextResponse.json({ ok: true, rows: rows.length }, { status: 200 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
