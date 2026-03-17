import { NextRequest, NextResponse } from "next/server";
import { getConfig, saveConfig, ensureDailyBackup } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    await ensureDailyBackup();
    return NextResponse.json(await getConfig());
  } catch (err) {
    console.error("[API ERROR]", req.method, req.url, err);
    return NextResponse.json({ error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    await saveConfig(body);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API ERROR]", req.method, req.url, err);
    return NextResponse.json({ error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
