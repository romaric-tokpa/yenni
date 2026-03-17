import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies, getAvatarUrl } from "@/lib/auth";
import { getUserById } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ user: null });
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        email: user.email,
        avatar_path: getAvatarUrl(user.avatar_path) || null,
      },
    });
  } catch (err) {
    console.error("[API ERROR]", req.method, req.url, err);
    return NextResponse.json({ error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
