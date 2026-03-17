import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import {
  getLoanSchedule,
  saveLoanSchedule,
  markSchedulePaid,
  markScheduleUnpaid,
  refreshScheduleStatuses,
  getLoan,
  updateLoan,
  addExpense,
  updateScheduleExpenseId,
} from "@/lib/db";
import type { LoanScheduleInput } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const loanIdParam = searchParams.get("loan_id");
    const loanId = loanIdParam ? parseInt(loanIdParam, 10) : NaN;
    if (!loanIdParam || isNaN(loanId)) {
      return NextResponse.json({ error: "loan_id requis" }, { status: 400 });
    }

    await refreshScheduleStatuses(session.userId);
    const schedule = await getLoanSchedule(loanId);
    const filtered = schedule.filter((row) => row.user_id === session.userId);
    return NextResponse.json(filtered);
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(
      { error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const body = await req.json();
    const loanId = typeof body.loan_id === "number" ? body.loan_id : parseInt(body.loan_id, 10);
    const schedule = body.schedule as LoanScheduleInput[] | undefined;

    if (!body.loan_id || isNaN(loanId)) {
      return NextResponse.json({ error: "loan_id requis" }, { status: 400 });
    }
    if (!Array.isArray(schedule)) {
      return NextResponse.json({ error: "schedule requis (tableau)" }, { status: 400 });
    }

    await saveLoanSchedule(session.userId, loanId, schedule);
    const paid = schedule.filter((r) => r.status === "paid");
    if (paid.length > 0) {
      const lastPaid = paid[paid.length - 1];
      const nextPending = schedule.find((r) => r.status !== "paid");
      const loan = await getLoan(loanId);
      if (loan) {
        await updateLoan(loanId, {
          remaining_amount: lastPaid.remaining_balance,
          paid_payments: paid.length,
          next_due_date: nextPending?.due_date ?? "",
        });
      }
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(
      { error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const body = await req.json();
    const loanId = typeof body.loan_id === "number" ? body.loan_id : parseInt(body.loan_id, 10);
    const number = typeof body.number === "number" ? body.number : parseInt(body.number, 10);
    const action = body.action as "pay" | "unpay" | undefined;
    const note = typeof body.note === "string" ? body.note : undefined;

    if (!body.loan_id || isNaN(loanId)) {
      return NextResponse.json({ error: "loan_id requis" }, { status: 400 });
    }
    if (!body.number || isNaN(number)) {
      return NextResponse.json({ error: "number requis" }, { status: 400 });
    }
    if (action !== "pay" && action !== "unpay") {
      return NextResponse.json({ error: "action doit être 'pay' ou 'unpay'" }, { status: 400 });
    }

    const schedule = await getLoanSchedule(loanId);
    const row = schedule.find((r) => r.number === number && r.user_id === session.userId);
    if (!row) {
      return NextResponse.json({ error: "Échéance non trouvée ou non autorisée" }, { status: 404 });
    }

    const updated =
      action === "pay"
        ? await markSchedulePaid(loanId, number, note)
        : await markScheduleUnpaid(loanId, number);

    if (!updated) {
      return NextResponse.json({ error: "Échec de la mise à jour" }, { status: 500 });
    }

    if (action === "pay" && updated) {
      const loan = await getLoan(loanId);
      const paidAt = updated.paid_at ? new Date(updated.paid_at) : new Date();
      const dateStr = paidAt.toISOString().split("T")[0];
      const timeStr = paidAt.toTimeString().slice(0, 5);
      const expense = await addExpense(
        {
          date: dateStr,
          time: timeStr,
          description: `Échéance #${number} - ${loan?.label ?? "Prêt"}`,
          category: "loan_repayment",
          amount: updated.total_payment,
          notes: note ?? "",
        },
        session.userId
      );
      await updateScheduleExpenseId(loanId, number, expense.id);
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(
      { error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
