import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { getSessionFromCookies } from "@/lib/auth";
import { getIncomes, getIncomesByDateRange, addIncome, deleteIncome } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    if (start && end) {
      return NextResponse.json(await getIncomesByDateRange(start, end));
    }
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const incomes =
      month !== null && year !== null
        ? await getIncomes(parseInt(month), parseInt(year))
        : await getIncomes();
    return NextResponse.json(incomes);
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
    const acc = body.account_id != null ? parseInt(String(body.account_id), 10) : NaN;
    if (
      !body.date ||
      !body.description ||
      !body.amount ||
      body.amount <= 0 ||
      !Number.isFinite(acc) ||
      acc <= 0
    ) {
      return NextResponse.json({ error: "Données invalides : compte requis" }, { status: 400 });
    }
    const income = await addIncome({ ...body, account_id: acc }, session.userId);
    return NextResponse.json(income, { status: 201 });
  } catch (err) {
    console.error("[API ERROR]", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg === "ACCOUNT_ID_REQUIRED" || msg === "ACCOUNT_NOT_FOUND") {
      return NextResponse.json({ error: "Compte requis ou introuvable" }, { status: 400 });
    }
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id)
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const ok = await deleteIncome(parseInt(id));
    return ok
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: "Non trouvé" }, { status: 404 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
