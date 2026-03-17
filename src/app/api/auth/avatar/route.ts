import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { updateUserAvatar, getUserById } from "@/lib/db";

const MAX_SIZE = 500 * 1024; // 500 Ko

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const user = await getUserById(session.userId);
    if (!user?.avatar_path) return new NextResponse(null, { status: 404 });

    if (!user.avatar_path.startsWith("data:")) {
      return new NextResponse(null, { status: 404 });
    }

    const match = user.avatar_path.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (!match) return new NextResponse(null, { status: 400 });

    const [, mimeType, base64] = match;
    const buffer = Buffer.from(base64, "base64");

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json({ error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

const MIME_TO_PREFIX: Record<string, string> = {
  "image/jpeg": "data:image/jpeg;base64,",
  "image/png": "data:image/png;base64,",
  "image/webp": "data:image/webp;base64,",
  "image/gif": "data:image/gif;base64,",
};

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 500 Ko)" }, { status: 400 });
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: "Format non supporté (JPG, PNG, WebP, GIF uniquement)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const prefix = MIME_TO_PREFIX[file.type] ?? "data:image/jpeg;base64,";
    const dataUri = `${prefix}${base64}`;

    await updateUserAvatar(session.userId, dataUri);

    return NextResponse.json({ avatar_path: dataUri });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json({ error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    await updateUserAvatar(session.userId, null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json({ error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
