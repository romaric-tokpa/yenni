import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getShoppingListItems, addShoppingListItem } from "@/lib/db";
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

    return NextResponse.json(await getShoppingListItems(listId));
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
    const { name, estimated_amount, category } = body;

    if (!name || estimated_amount === undefined) {
      return NextResponse.json({ error: "name et estimated_amount requis" }, { status: 400 });
    }

    const amount = Math.max(0, parseInt(String(estimated_amount), 10) || 0);
    const item = await addShoppingListItem({
      list_id: listId,
      name: String(name).trim(),
      category: category || "food",
      estimated_amount: amount,
      actual_amount: null,
      status: "pending",
      purchased_at: null,
      expense_id: null,
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
