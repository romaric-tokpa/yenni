import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { getLogoSvg } from "@/lib/db";

export async function GET() {
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
