import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getWishLists, addWishList } from "@/lib/db";
import { apiErrorResponse } from "@/lib/apiError";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const monthNum = month ? parseInt(month, 10) : undefined;
    const yearNum = year ? parseInt(year, 10) : undefined;
    return NextResponse.json(await getWishLists(monthNum, yearNum));
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
    const { name, scheduled_date } = body;

    if (!name || !scheduled_date) {
      return NextResponse.json({ error: "name et scheduled_date requis" }, { status: 400 });
    }

    const list = await addWishList({
      name: String(name).trim(),
      scheduled_date: String(scheduled_date),
    });
    return NextResponse.json(list, { status: 201 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
