import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getWishes, addWish } from "@/lib/db";
import { apiErrorResponse } from "@/lib/apiError";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const sp = new URL(req.url).searchParams;
    const status = sp.get("status") as "pending" | "purchased" | undefined;
    return NextResponse.json(await getWishes(status));
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
    const { name, target_date, estimated_amount, category, subcategory, notes } = body;

    if (!name || !target_date || estimated_amount === undefined) {
      return NextResponse.json({ error: "name, target_date et estimated_amount requis" }, { status: 400 });
    }

    const amount = Math.max(0, parseInt(String(estimated_amount), 10) || 0);
    const wish = await addWish({
      name: String(name).trim(),
      target_date: String(target_date),
      estimated_amount: amount,
      actual_amount: null,
      category: category || "misc",
      subcategory: subcategory || null,
      notes: notes || "",
      status: "pending",
      expense_id: null,
    });
    return NextResponse.json(wish, { status: 201 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
