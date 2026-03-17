import { NextRequest, NextResponse } from "next/server";
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
} from "@/lib/db";

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
    return NextResponse.json({ error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    const body = await req.json();
    if (body.batch && Array.isArray(body.payments) && body.loan_id) {
      const count = await addLoanPaymentsBatch(body.loan_id, body.payments);
      return NextResponse.json({ count }, { status: 201 });
    }
    if (!body.loan_id || !body.amount || body.amount <= 0 || !body.date) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }
    const payment = await addLoanPayment(body);
    const loan = await getLoan(body.loan_id);
    if (loan && session) {
      const dateStr = body.date;
      const timeStr = body.time || "00:00";
      const amount = body.amount + (body.fees || 0);
      const desc = `${loan.type === "personal_lent" ? "Remb. reçu" : "Remboursement"} — ${loan.label}`;
      if (loan.type === "personal_borrowed") {
        const expense = await addExpense(
          {
            date: dateStr,
            time: timeStr,
            description: desc,
            category: "loan_repayment",
            amount,
            notes: body.notes || "",
          },
          session.userId
        );
        await updateLoanPaymentExpenseId(payment.id, expense.id);
      } else if (loan.type === "personal_lent") {
        const income = await addIncome({
          date: dateStr,
          time: timeStr,
          description: desc,
          source: "loan_recovery",
          amount: body.amount,
          notes: body.notes || "",
        });
        await updateLoanPaymentIncomeId(payment.id, income.id);
      }
    }
    return NextResponse.json(payment, { status: 201 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json({ error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
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
    return NextResponse.json({ error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
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
    return NextResponse.json({ error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
