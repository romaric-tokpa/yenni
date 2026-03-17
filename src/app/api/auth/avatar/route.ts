import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies, getAvatarUrl } from "@/lib/auth";
import { updateUserAvatar, getUserById } from "@/lib/db";
import { writeFile, mkdir, unlink, open } from "fs/promises";
import path from "path";
import { AVATARS_DIR, getAvatarFilePath } from "@/lib/paths";
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  try {
    if (process.env.TURSO_DATABASE_URL) {
      return NextResponse.json({ error: "Upload d'avatar non disponible en production (stockage externe requis)" }, { status: 503 });
    }
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "Fichier trop volumineux (max 5 Mo)" }, { status: 400 });

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: "Format non supporté (JPG, PNG, WebP, GIF uniquement)" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${session.userId}-${Date.now()}.${ext}`;

    await mkdir(AVATARS_DIR, { recursive: true });

    const oldUser = await getUserById(session.userId);
    if (oldUser?.avatar_path) {
      const oldFile = getAvatarFilePath(path.basename(oldUser.avatar_path));
      try { await unlink(oldFile); } catch { /* file may not exist */ }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(AVATARS_DIR, filename);
    await writeFile(filePath, buffer);
    const fd = await open(filePath, "r");
    await fd.datasync();
    await fd.close();

    const avatarPath = `/uploads/avatars/${filename}`;
    await updateUserAvatar(session.userId, avatarPath);

    return NextResponse.json({ avatar_path: getAvatarUrl(avatarPath) });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const user = await getUserById(session.userId);
    if (user?.avatar_path && !process.env.TURSO_DATABASE_URL) {
      const oldFile = getAvatarFilePath(path.basename(user.avatar_path));
      try { await unlink(oldFile); } catch { /* file may not exist */ }
    }

    await updateUserAvatar(session.userId, null);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
