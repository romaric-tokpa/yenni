import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { getSavings, setSaving, getTotalSavingsCumulative, getSavingsInPeriod } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get("cumulative") === "true") {
      return NextResponse.json(await getTotalSavingsCumulative());
    }
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    if (startDate && endDate) {
      return NextResponse.json(await getSavingsInPeriod(startDate, endDate));
    }
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear())
    );
    return NextResponse.json(await getSavings(year));
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
    await setSaving(month, year, amount);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
