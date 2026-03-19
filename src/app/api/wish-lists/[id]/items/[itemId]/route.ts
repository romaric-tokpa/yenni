import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { updateWishListItem, markWishItemPurchased, deleteWishListItem } from "@/lib/db";
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
      const expense = await markWishItemPurchased(itemId, Number(actualAmount), session.userId);
      if (!expense) return NextResponse.json({ error: "Article non trouvé ou déjà acheté" }, { status: 404 });
      return NextResponse.json(expense);
    }

    const {
      name,
      target_date,
      estimated_amount,
      category,
      subcategory,
      notes,
      shop_name,
      shop_phone,
      shop_address,
      shop_lat,
      shop_lng,
    } = body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (target_date !== undefined) updates.target_date = String(target_date);
    if (estimated_amount !== undefined) updates.estimated_amount = Math.max(0, Number(estimated_amount) || 0);
    if (category !== undefined) updates.category = String(category);
    if (subcategory !== undefined) updates.subcategory = subcategory ? String(subcategory) : null;
    if (notes !== undefined) updates.notes = String(notes);
    if (shop_name !== undefined) updates.shop_name = shop_name ? String(shop_name).trim() : null;
    if (shop_phone !== undefined) updates.shop_phone = shop_phone ? String(shop_phone).trim() : null;
    if (shop_address !== undefined) updates.shop_address = shop_address ? String(shop_address).trim() : null;
    if (shop_lat !== undefined) updates.shop_lat = shop_lat != null ? Number(shop_lat) : null;
    if (shop_lng !== undefined) updates.shop_lng = shop_lng != null ? Number(shop_lng) : null;

    const item = await updateWishListItem(itemId, updates);
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

    const ok = await deleteWishListItem(itemId);
    if (!ok) return NextResponse.json({ error: "Article non trouvé" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
