import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { getSessionFromCookies } from "@/lib/auth";
import {
  getLoanPayments,
  getLoanPaymentsByDateRange,
  addLoanPayment,
  addLoanPaymentsBatch,
  updateLoanPayment,
  deleteLoanPayment,
  getLoan,
  addExpense,
  addIncome,
  updateLoanPaymentExpenseId,
  updateLoanPaymentIncomeId,
  resolveLoanRepaymentDebitAccountId,
  resolveLoanRecoveryCreditAccountId,
} from "@/lib/db";

function loanPaymentAccountErrorResponse(err: unknown): NextResponse | null {
  const msg = err instanceof Error ? err.message : "";
  const map: Record<string, string> = {
    NO_BANK_CURRENT_ACCOUNT:
      "Ajoute au moins un compte bancaire dans Trésorerie pour ce remboursement (échéance prêt).",
    BANK_LOAN_PICK_CURRENT_ACCOUNT:
      "Tu as plusieurs comptes bancaires : choisis celui des prélèvements dans la fiche du prêt.",
    INVALID_BANK_CURRENT_ACCOUNT:
      "Le compte débité doit être un compte bancaire de trésorerie (hors épargne bloquée).",
    INVALID_REPAYMENT_ACCOUNT: "Compte de remboursement invalide ou non autorisé (coffre verrouillé ou archivé).",
    INVALID_RECOVERY_ACCOUNT: "Compte d’encaissement invalide ou archivé.",
    LOAN_REPAYMENT_DEBIT_NOT_APPLICABLE: "Ce type de prêt ne correspond pas à une sortie de trésorerie.",
  };
  const text = map[msg];
  if (text) return NextResponse.json({ error: text }, { status: 400 });
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const start = sp.get("start");
    const end = sp.get("end");
    if (start && end) return NextResponse.json(await getLoanPaymentsByDateRange(start, end));
    const loanId = sp.get("loan_id");
    const month = sp.get("month");
    const year = sp.get("year");
    if (loanId) return NextResponse.json(await getLoanPayments(parseInt(loanId)));
    if (month !== null && year !== null) return NextResponse.json(await getLoanPayments(undefined, parseInt(month), parseInt(year)));
    return NextResponse.json(await getLoanPayments());
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    const body = await req.json();
    if (body.batch && Array.isArray(body.payments) && body.loan_id) {
      if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
      const count = await addLoanPaymentsBatch(body.loan_id, session.userId, body.payments);
      return NextResponse.json({ count }, { status: 201 });
    }
    if (!body.loan_id || !body.amount || body.amount <= 0 || !body.date) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const loan = await getLoan(body.loan_id);
    let payAcc = 0;
    const overrideAcc = body.account_id != null ? parseInt(String(body.account_id), 10) : undefined;
    if (loan && session) {
      try {
        if (loan.type === "personal_borrowed" || loan.type === "bank") {
          payAcc = await resolveLoanRepaymentDebitAccountId(
            session.userId,
            loan,
            overrideAcc != null && !Number.isNaN(overrideAcc) ? overrideAcc : null,
          );
        } else if (loan.type === "personal_lent") {
          payAcc = await resolveLoanRecoveryCreditAccountId(
            session.userId,
            loan,
            overrideAcc != null && !Number.isNaN(overrideAcc) ? overrideAcc : null,
          );
        }
      } catch (e) {
        const r = loanPaymentAccountErrorResponse(e);
        if (r) return r;
        throw e;
      }
    }
    const payment = await addLoanPayment({ ...body, account_id: payAcc });
    if (loan && session) {
      const dateStr = body.date;
      const timeStr = body.time || "00:00";
      const amount = body.amount + (body.fees || 0);
      const desc = `${loan.type === "personal_lent" ? "Remb. reçu" : "Remboursement"} — ${loan.label}`;
      try {
        if (loan.type === "personal_borrowed" || loan.type === "bank") {
          const expense = await addExpense(
            {
              date: dateStr,
              time: timeStr,
              description: desc,
              category: "loan_repayment",
              amount,
              notes: body.notes || "",
              account_id: payAcc,
            },
            session.userId
          );
          await updateLoanPaymentExpenseId(payment.id, expense.id, payAcc);
        } else if (loan.type === "personal_lent") {
          const income = await addIncome(
            {
              date: dateStr,
              time: timeStr,
              description: desc,
              source: "loan_recovery",
              amount: body.amount,
              notes: body.notes || "",
              account_id: payAcc,
            },
            session.userId
          );
          await updateLoanPaymentIncomeId(payment.id, income.id, payAcc);
        }
      } catch (e) {
        const r = loanPaymentAccountErrorResponse(e);
        if (r) return r;
        throw e;
      }
    }
    return NextResponse.json(payment, { status: 201 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const id = parseInt(new URL(req.url).searchParams.get("id") || "0");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const body = await req.json();
    const { amount, fees, date, time, notes } = body;
    const updates: Record<string, unknown> = {};
    if (typeof amount === "number" && amount > 0) updates.amount = amount;
    if (typeof fees === "number" && fees >= 0) updates.fees = fees;
    if (typeof date === "string") updates.date = date;
    if (typeof time === "string") updates.time = time;
    if (typeof notes === "string") updates.notes = notes;
    const payment = await updateLoanPayment(id, updates);
    if (!payment) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    return NextResponse.json(payment);
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = parseInt(new URL(req.url).searchParams.get("id") || "0");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const ok = await deleteLoanPayment(id);
    if (!ok) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
