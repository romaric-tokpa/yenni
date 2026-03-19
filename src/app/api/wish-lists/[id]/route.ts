import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { updateWishList, deleteWishList } from "@/lib/db";
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
    const { name, scheduled_date } = body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (scheduled_date !== undefined) updates.scheduled_date = String(scheduled_date);

    const list = await updateWishList(id, updates);
    if (!list) return NextResponse.json({ error: "Liste non trouvée" }, { status: 404 });
    return NextResponse.json(list);
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

    const ok = await deleteWishList(id);
    if (!ok) return NextResponse.json({ error: "Liste non trouvée" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
