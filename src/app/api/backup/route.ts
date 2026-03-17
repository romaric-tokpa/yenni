import { NextRequest, NextResponse } from "next/server";
import { exportBackup, importBackup } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const backup = await exportBackup();
    const filename = `monbudget-backup-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[API ERROR]", req.method, req.url, err);
    return NextResponse.json(
      { error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await importBackup(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Restauration échouée" },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API ERROR]", req.method, req.url, err);
    return NextResponse.json(
      { error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
