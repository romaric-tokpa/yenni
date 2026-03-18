import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
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
    const body = await req.json();
    if (!body.date || !body.description || !body.amount || body.amount <= 0) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }
    const income = await addIncome(body);
    return NextResponse.json(income, { status: 201 });
  } catch (err) {
    console.error("[API ERROR]", err);
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
