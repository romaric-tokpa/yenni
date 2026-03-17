import { NextRequest, NextResponse } from "next/server";
import { getPlannedExpenses, addPlannedExpense, updatePlannedExpense, deletePlannedExpense, executeDuePlannedExpenses, executePlannedExpenseById } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const status = sp.get("status") || undefined;
    const execute = sp.get("execute");
    const executeId = sp.get("execute_id");
    if (execute === "true") {
      const result = await executeDuePlannedExpenses();
      return NextResponse.json(result);
    }
    if (executeId) {
      const expense = await executePlannedExpenseById(parseInt(executeId));
      if (!expense) return NextResponse.json({ error: "Non trouvé ou déjà exécuté" }, { status: 404 });
      return NextResponse.json(expense);
    }
    return NextResponse.json(await getPlannedExpenses(status));
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json({ error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.due_date || !body.description || !body.category || !body.amount || body.amount <= 0) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }
    const planned = await addPlannedExpense(body);
    return NextResponse.json(planned, { status: 201 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json({ error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const updated = await updatePlannedExpense(id, updates);
    if (!updated) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json({ error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = parseInt(new URL(req.url).searchParams.get("id") || "0");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const ok = await deletePlannedExpense(id);
    if (!ok) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json({ error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
