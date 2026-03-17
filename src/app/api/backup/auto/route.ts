import { NextResponse } from "next/server";
import { ensureDailyBackup, getAutoBackupList } from "@/lib/db";
import path from "path";
import fs from "fs";

export async function GET() {
  try {
    await ensureDailyBackup();
    const list = await getAutoBackupList();
    return NextResponse.json({
      backups: list.map((b) => ({
        date: b.date,
        filename: path.basename(b.path),
      })),
    });
  } catch (err) {
    console.error("Auto backup error:", err);
    return NextResponse.json(
      { error: "Erreur lors de la sauvegarde automatique" },
      { status: 500 }
    );
  }
}
