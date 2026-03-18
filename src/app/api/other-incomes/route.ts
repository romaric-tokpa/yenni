import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { getOtherIncomes, setOtherIncome } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const year = parseInt(
      new URL(req.url).searchParams.get("year") ||
        String(new Date().getFullYear())
    );
    return NextResponse.json(await getOtherIncomes(year));
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { month, year, amount } = await req.json();
    if (month === undefined || !year || amount === undefined) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }
    await setOtherIncome(month, year, Math.max(0, amount));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
