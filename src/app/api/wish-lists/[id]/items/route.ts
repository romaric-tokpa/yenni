import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getWishListItems, addWishListItem } from "@/lib/db";
import { apiErrorResponse } from "@/lib/apiError";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const listId = parseInt((await params).id, 10);
    if (isNaN(listId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    return NextResponse.json(await getWishListItems(listId));
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
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const listId = parseInt((await params).id, 10);
    if (isNaN(listId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
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

    if (!name || !target_date || estimated_amount === undefined) {
      return NextResponse.json({ error: "name, target_date et estimated_amount requis" }, { status: 400 });
    }

    const amount = Math.max(0, parseInt(String(estimated_amount), 10) || 0);
    const item = await addWishListItem({
      list_id: listId,
      name: String(name).trim(),
      target_date: String(target_date),
      estimated_amount: amount,
      actual_amount: null,
      category: category || "misc",
      subcategory: subcategory || null,
      notes: notes || "",
      status: "pending",
      purchased_at: null,
      expense_id: null,
      shop_name: shop_name ? String(shop_name).trim() : null,
      shop_phone: shop_phone ? String(shop_phone).trim() : null,
      shop_address: shop_address ? String(shop_address).trim() : null,
      shop_lat: shop_lat != null ? Number(shop_lat) : null,
      shop_lng: shop_lng != null ? Number(shop_lng) : null,
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
