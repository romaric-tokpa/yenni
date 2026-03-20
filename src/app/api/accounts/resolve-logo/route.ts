import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/apiError";
import { resolveAccountLogoInput } from "@/lib/accountLogoParse";

/** Prévisualisation / import : télécharge une image HTTPS et renvoie une data URI. */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const body = await req.json();
    const url = body.url != null ? String(body.url).trim() : "";
    if (!url.startsWith("https://")) {
      return NextResponse.json({ error: "Indique une URL HTTPS complète (https://…)" }, { status: 400 });
    }
    const resolved = await resolveAccountLogoInput(url);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    return NextResponse.json({ dataUri: resolved.dataUri });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
