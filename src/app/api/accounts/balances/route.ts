import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { recalculateAllBalances } from "@/lib/account-balance";
import { apiErrorResponse } from "@/lib/apiError";

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const balances = await recalculateAllBalances(session.userId);
    return NextResponse.json({ balances });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
