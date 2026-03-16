import { NextRequest, NextResponse } from "next/server";
import { getSavings, setSaving } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const year = parseInt(
      new URL(req.url).searchParams.get("year") ||
        String(new Date().getFullYear())
    );
    return NextResponse.json(getSavings(year));
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
    setSaving(month, year, amount);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
