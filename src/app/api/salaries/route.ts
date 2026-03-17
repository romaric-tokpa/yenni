import { NextRequest, NextResponse } from "next/server";
import { getSalaries, setSalary } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const year = parseInt(
      new URL(req.url).searchParams.get("year") ||
        String(new Date().getFullYear())
    );
    return NextResponse.json(await getSalaries(year));
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
    await setSalary(month, year, Math.max(0, amount));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
