import { NextRequest, NextResponse } from "next/server";
import { getAutoBackupList } from "@/lib/db";
import path from "path";
import fs from "fs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    if (process.env.TURSO_DATABASE_URL) {
      return NextResponse.json({ error: "Sauvegardes locales non disponibles en production" }, { status: 404 });
    }
    const { date } = await params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Date invalide" }, { status: 400 });
    }
    const list = await getAutoBackupList();
    const found = list.find((b) => b.date === date);
    if (!found || !fs.existsSync(found.path)) {
      return NextResponse.json({ error: "Sauvegarde introuvable" }, { status: 404 });
    }
    const content = fs.readFileSync(found.path, "utf-8");
    const filename = `monbudget-backup-${date}.json`;
    return new NextResponse(content, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[API ERROR]", _req.method, _req.url, err);
    return NextResponse.json(
      { error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
