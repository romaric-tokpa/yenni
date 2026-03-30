import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getExpenses, getExpensesByDateRange, addExpense, updateExpense, deleteExpense } from "@/lib/db";
import { apiErrorResponse } from "@/lib/apiError";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    if (start && end) {
      return NextResponse.json(await getExpensesByDateRange(start, end));
    }
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const offset = offsetParam ? parseInt(offsetParam, 10) : undefined;
    const expenses =
      month !== null && year !== null
        ? await getExpenses(parseInt(month), parseInt(year), limit, offset)
        : await getExpenses(undefined, undefined, limit, offset);
    return NextResponse.json(expenses);
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const body = await req.json();
    const accPost = body.account_id != null ? parseInt(String(body.account_id), 10) : NaN;
    if (
      !body.date ||
      !body.description ||
      !body.category ||
      !body.amount ||
      body.amount <= 0 ||
      !Number.isFinite(accPost) ||
      accPost <= 0
    ) {
      return NextResponse.json({ error: "Données invalides : compte requis" }, { status: 400 });
    }
    const expenseData = {
      ...body,
      payment_method: "cash",
      transaction_fee: body.transaction_fee ?? 0,
      account_id: body.account_id,
    };
    const expense = await addExpense(expenseData, session.userId);
    return NextResponse.json(expense, { status: 201 });
  } catch (err) {
    console.error("[API ERROR]", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg === "ACCOUNT_VAULT_LOCKED") {
      return NextResponse.json({ error: "Dépense impossible sur ce compte pour le moment." }, { status: 403 });
    }
    if (msg === "ACCOUNT_NOT_FOUND" || msg === "ACCOUNT_ID_REQUIRED") {
      return NextResponse.json({ error: "Compte requis ou compte introuvable" }, { status: 400 });
    }
    if (msg === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ error: "Solde insuffisant sur ce compte" }, { status: 400 });
    }
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const id = typeof body.id === "number" ? body.id : parseInt(body.id, 10);
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }
    const accPut = body.account_id != null ? parseInt(String(body.account_id), 10) : NaN;
    if (
      !body.date ||
      !body.description ||
      !body.category ||
      !body.amount ||
      body.amount <= 0 ||
      !Number.isFinite(accPut) ||
      accPut <= 0
    ) {
      return NextResponse.json({ error: "Données invalides : compte requis" }, { status: 400 });
    }
    const expense = await updateExpense(id, {
      date: body.date,
      time: body.time,
      description: body.description,
      category: body.category,
      amount: body.amount,
      notes: body.notes,
      payment_method: "cash",
      transaction_fee: body.transaction_fee,
      account_id: body.account_id,
    });
    if (!expense) {
      return NextResponse.json({ error: "Dépense introuvable" }, { status: 404 });
    }
    return NextResponse.json(expense);
  } catch (err) {
    console.error("[API ERROR]", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg === "ACCOUNT_VAULT_LOCKED") {
      return NextResponse.json({ error: "Dépense impossible sur ce compte pour le moment." }, { status: 403 });
    }
    if (msg === "ACCOUNT_NOT_FOUND" || msg === "ACCOUNT_ID_REQUIRED") {
      return NextResponse.json({ error: "Compte introuvable ou requis" }, { status: 404 });
    }
    if (msg === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ error: "Solde insuffisant sur ce compte" }, { status: 400 });
    }
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id)
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const ok = await deleteExpense(parseInt(id));
    return ok
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: "Non trouvé" }, { status: 404 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
