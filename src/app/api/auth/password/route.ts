import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { apiErrorResponse } from "@/lib/apiError";
import { getSessionFromCookies } from "@/lib/auth";
import { getUserById, updateUserPassword } from "@/lib/db";

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { current_password, new_password } = await req.json();

    if (!current_password || !new_password) {
      return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 });
    }
    if (new_password.length < 6) {
      return NextResponse.json({ error: "Le nouveau mot de passe doit contenir au moins 6 caractères" }, { status: 400 });
    }

    const user = await getUserById(session.userId);
    if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 403 });

    const hash = await bcrypt.hash(new_password, 12);
    await updateUserPassword(user.id, hash);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
