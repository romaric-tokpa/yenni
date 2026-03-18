import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { ensureDailyBackup, getAutoBackupList } from "@/lib/db";
import path from "path";
import fs from "fs";

export async function GET(req: NextRequest) {
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
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
