import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { getSessionFromCookies } from "@/lib/auth";
import { getAccountById, getSalaries, setSalary, syncSalaryLinkedIncome } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const year = parseInt(
      new URL(req.url).searchParams.get("year") ||
        String(new Date().getFullYear())
    );
    return NextResponse.json(await getSalaries(year));
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const raw = await req.text();
    if (!raw.trim()) {
      return NextResponse.json({ error: "Corps de requête vide" }, { status: 400 });
    }
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    let body: { month?: unknown; year?: unknown; amount?: unknown; account_id?: unknown };
    try {
      body = JSON.parse(raw) as { month?: unknown; year?: unknown; amount?: unknown; account_id?: unknown };
    } catch {
      return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
    }
    const month = Number(body.month);
    const year = Number(body.year);
    const amount = Number(body.amount);
    if (!Number.isInteger(month) || month < 0 || month > 11 || !Number.isFinite(year) || year < 1970) {
      return NextResponse.json({ error: "Données invalides (mois / année)" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "Données invalides (montant)" }, { status: 400 });
    }

    let accountId: number | null = null;
    if (body.account_id !== undefined && body.account_id !== null && body.account_id !== "") {
      const aid = parseInt(String(body.account_id), 10);
      if (Number.isNaN(aid)) {
        return NextResponse.json({ error: "Compte invalide" }, { status: 400 });
      }
      const acc = await getAccountById(aid, session.userId);
      if (!acc) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
      accountId = aid;
    }

    const rounded = Math.max(0, Math.round(amount));
    await setSalary(month, year, rounded, accountId);
    await syncSalaryLinkedIncome(year, month, rounded, accountId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
