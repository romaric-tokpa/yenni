import { NextRequest, NextResponse } from "next/server";
import { getProjectFundsSumForMonth } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month = parseInt(searchParams.get("month") ?? "", 10);
    const year = parseInt(searchParams.get("year") ?? "", 10);
    if (isNaN(month) || month < 0 || month > 11 || isNaN(year)) {
      return NextResponse.json({ error: "month (0-11) et year requis" }, { status: 400 });
    }
    const sum = await getProjectFundsSumForMonth(month, year);
    return NextResponse.json({ sum });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
