import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { updateShoppingListItem, markShoppingItemPurchased, deleteShoppingListItem } from "@/lib/db";
import { apiErrorResponse } from "@/lib/apiError";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const itemId = parseInt((await params).itemId, 10);
    if (isNaN(itemId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const action = body.action as "update" | "purchase" | undefined;

    if (action === "purchase") {
      const actualAmount = body.actual_amount ?? body.actualAmount;
      if (actualAmount === undefined || actualAmount === null || Number(actualAmount) < 0) {
        return NextResponse.json({ error: "actual_amount requis (montant réel d'achat)" }, { status: 400 });
      }
      const expense = await markShoppingItemPurchased(itemId, Number(actualAmount), session.userId);
      if (!expense) return NextResponse.json({ error: "Article non trouvé ou déjà acheté" }, { status: 404 });
      return NextResponse.json(expense);
    }

    const { name, estimated_amount, category } = body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (category !== undefined) updates.category = String(category);
    if (estimated_amount !== undefined) updates.estimated_amount = Math.max(0, Number(estimated_amount) || 0);

    const item = await updateShoppingListItem(itemId, updates);
    if (!item) return NextResponse.json({ error: "Article non trouvé" }, { status: 404 });
    return NextResponse.json(item);
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const itemId = parseInt((await params).itemId, 10);
    if (isNaN(itemId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const ok = await deleteShoppingListItem(itemId);
    if (!ok) return NextResponse.json({ error: "Article non trouvé" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
