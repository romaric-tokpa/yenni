import { NextResponse } from "next/server";
import { COOKIE_NAME, getCookieOptions } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, "", { ...getCookieOptions(), maxAge: 0 });
  return response;
}
