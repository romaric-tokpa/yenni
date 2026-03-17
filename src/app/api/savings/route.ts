import { NextRequest, NextResponse } from "next/server";
import { getSavings, setSaving, getTotalSavingsCumulative } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get("cumulative") === "true") {
      return NextResponse.json(await getTotalSavingsCumulative());
    }
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear())
    );
    return NextResponse.json(await getSavings(year));
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
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
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
