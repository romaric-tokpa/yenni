import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { updateWish, markWishPurchased, deleteWish } from "@/lib/db";
import { apiErrorResponse } from "@/lib/apiError";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const id = parseInt((await params).id, 10);
    if (isNaN(id)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const action = body.action as "update" | "purchase" | undefined;

    if (action === "purchase") {
      const actualAmount = body.actual_amount ?? body.actualAmount;
      if (actualAmount === undefined || actualAmount === null || Number(actualAmount) < 0) {
        return NextResponse.json({ error: "actual_amount requis (montant réel d'achat)" }, { status: 400 });
      }
      const transactionFee = body.transaction_fee ?? 0;
      const accountId = body.account_id ?? null;
      const expense = await markWishPurchased(id, Number(actualAmount), session.userId, transactionFee, accountId);
      if (!expense) return NextResponse.json({ error: "Envie non trouvée ou déjà achetée" }, { status: 404 });
      return NextResponse.json(expense);
    }

    const { name, target_date, estimated_amount, actual_amount, category, subcategory, notes } = body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (target_date !== undefined) updates.target_date = String(target_date);
    if (estimated_amount !== undefined) updates.estimated_amount = Math.max(0, Number(estimated_amount) || 0);
    if (actual_amount !== undefined) updates.actual_amount = actual_amount !== null && actual_amount !== "" ? Math.max(0, Number(actual_amount) || 0) : null;
    if (category !== undefined) updates.category = String(category);
    if (subcategory !== undefined) updates.subcategory = subcategory ? String(subcategory) : null;
    if (notes !== undefined) updates.notes = String(notes);

    const wish = await updateWish(id, updates);
    if (!wish) return NextResponse.json({ error: "Envie non trouvée" }, { status: 404 });
    return NextResponse.json(wish);
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const id = parseInt((await params).id, 10);
    if (isNaN(id)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const ok = await deleteWish(id);
    if (!ok) return NextResponse.json({ error: "Envie non trouvée" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
