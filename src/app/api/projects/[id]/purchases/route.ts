import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import {
  getProjectPurchases,
  addProjectPurchase,
  deleteProjectPurchase,
  getProjects,
  deleteExpense,
  getProjectPurchase,
} from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }
    const purchases = await getProjectPurchases(projectId);
    return NextResponse.json(purchases);
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }
    const projects = await getProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project || project.status !== "completed") {
      return NextResponse.json({ error: "Projet non trouvé ou non réalisé" }, { status: 400 });
    }
    const body = await req.json();
    const { description, amount, date, expense_id } = body;
    if (!description || !amount || amount <= 0) {
      return NextResponse.json({ error: "Description et montant requis" }, { status: 400 });
    }
    const amountNum = Number(amount);
    if (amountNum > project.saved_amount) {
      return NextResponse.json(
        { error: `Dépassement : reste ${project.saved_amount} FCFA disponible` },
        { status: 400 }
      );
    }
    const purchase = await addProjectPurchase({
      project_id: projectId,
      description: String(description),
      amount: Number(amount),
      date: date || new Date().toISOString().split("T")[0],
      expense_id: expense_id ?? null,
    });
    return NextResponse.json(purchase, { status: 201 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }
    const purchaseId = parseInt(id, 10);
    const purchase = await getProjectPurchase(purchaseId);
    const ok = await deleteProjectPurchase(purchaseId);
    if (ok && purchase?.expense_id) {
      await deleteExpense(purchase.expense_id);
    }
    return ok
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: "Non trouvé" }, { status: 404 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
