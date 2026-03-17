import { NextRequest, NextResponse } from "next/server";
import { getLogoSvg } from "@/lib/db";

const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="#008080" stroke-width="6"/><ellipse cx="58" cy="62" rx="18" ry="8" fill="#FFA500"/><ellipse cx="50" cy="52" rx="18" ry="8" fill="#FFA500"/><ellipse cx="42" cy="42" rx="18" ry="8" fill="#FFA500"/></svg>`;

export async function GET(req: NextRequest) {
  try {
    const svg = await getLogoSvg();
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[API ERROR]", req.method, req.url, err);
    return NextResponse.json({ error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
