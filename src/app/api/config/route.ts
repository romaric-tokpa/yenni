import { NextRequest, NextResponse } from "next/server";
import { getConfig, saveConfig, ensureDailyBackup } from "@/lib/db";

export async function GET() {
  try {
    ensureDailyBackup();
    return NextResponse.json(getConfig());
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    saveConfig(body);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
