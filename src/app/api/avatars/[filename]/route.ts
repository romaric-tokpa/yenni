import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getAvatarFilePath } from "@/lib/paths";
const VALID_EXT = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    if (!filename || filename.includes("..") || filename.includes("/")) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }
    const ext = path.extname(filename).toLowerCase();
    if (!VALID_EXT.includes(ext)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    const filePath = getAvatarFilePath(filename);
    const buffer = await readFile(filePath);

    const contentType =
      ext === ".png"
        ? "image/png"
        : ext === ".gif"
          ? "image/gif"
          : ext === ".webp"
            ? "image/webp"
            : "image/jpeg";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      return new NextResponse(null, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
