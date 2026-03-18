import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { apiErrorResponse } from "@/lib/apiError";
import { createUser, getUserByEmail, getUserByPhone } from "@/lib/db";
import { createSession, COOKIE_NAME, getCookieOptions, getAvatarUrl } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { first_name, last_name, phone, email, password, confirm_password } = body;

    if (!first_name || !last_name || !phone || !email || !password) {
      return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Le mot de passe doit contenir au moins 6 caractères" }, { status: 400 });
    }

    if (password !== confirm_password) {
      return NextResponse.json({ error: "Les mots de passe ne correspondent pas" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }

    if (await getUserByEmail(email.toLowerCase())) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
    }

    if (await getUserByPhone(phone)) {
      return NextResponse.json({ error: "Ce numéro de téléphone est déjà utilisé" }, { status: 409 });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const user = await createUser({
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      phone: phone.trim(),
      email: email.toLowerCase().trim(),
      password_hash,
    });

    const token = await createSession({
      userId: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        email: user.email,
        avatar_path: getAvatarUrl(user.avatar_path) || null,
      },
    }, { status: 201 });

    response.cookies.set(COOKIE_NAME, token, getCookieOptions());

    return response;
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
