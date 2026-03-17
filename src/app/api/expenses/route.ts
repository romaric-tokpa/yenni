import { NextRequest, NextResponse } from "next/server";
import { getExpenses, getExpensesByDateRange, addExpense, updateExpense, deleteExpense } from "@/lib/db";

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
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (
      !body.date ||
      !body.description ||
      !body.category ||
      !body.amount ||
      body.amount <= 0
    ) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }
    const expense = await addExpense(body);
    return NextResponse.json(expense, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const id = typeof body.id === "number" ? body.id : parseInt(body.id, 10);
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }
    if (
      !body.date ||
      !body.description ||
      !body.category ||
      !body.amount ||
      body.amount <= 0
    ) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }
    const expense = await updateExpense(id, {
      date: body.date,
      time: body.time,
      description: body.description,
      category: body.category,
      amount: body.amount,
      notes: body.notes,
    });
    if (!expense) {
      return NextResponse.json({ error: "Dépense introuvable" }, { status: 404 });
    }
    return NextResponse.json(expense);
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
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
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
