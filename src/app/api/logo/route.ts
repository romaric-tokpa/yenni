import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { getLogoSvg } from "@/lib/db";

const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="#10b981" stroke-width="6"/><ellipse cx="58" cy="62" rx="18" ry="8" fill="#f59e0b"/><ellipse cx="50" cy="52" rx="18" ry="8" fill="#f59e0b"/><ellipse cx="42" cy="42" rx="18" ry="8" fill="#f59e0b"/></svg>`;

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
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
