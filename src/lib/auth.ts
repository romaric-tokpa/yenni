import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

let _secret: Uint8Array | null = null;

function getJwtSecret(): Uint8Array {
  if (_secret) return _secret;
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === "production";
  const isBuild = typeof process.env.NEXT_PHASE !== "undefined";
  if (isProd && !isBuild && (!secret || secret.length < 32)) {
    throw new Error("JWT_SECRET doit être défini et faire au moins 32 caractères en production");
  }
  _secret = new TextEncoder().encode(secret || "yenni-dev-secret-not-for-production");
  return _secret;
}
const COOKIE_NAME = "mb_session";
const EXPIRES_IN = 60 * 60 * 24 * 30; // 30 jours

export interface SessionPayload {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
}

export async function createSession(payload: SessionPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${EXPIRES_IN}s`)
    .setIssuedAt()
    .sign(getJwtSecret());
  return token;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export { COOKIE_NAME, EXPIRES_IN };

/** Retourne l'URL ou data URI pour l'avatar (base64 en DB utilisé directement, chemin legacy → /api/avatars/x) */
export function getAvatarUrl(avatarPath: string | null): string | null {
  if (!avatarPath) return null;
  if (avatarPath.startsWith("data:")) return avatarPath;
  const match = avatarPath.match(/(?:^\/?)?uploads\/avatars\/(.+)$/);
  if (match) return `/api/avatars/${match[1]}`;
  if (/^[^/]+\.(jpg|jpeg|png|webp|gif)$/i.test(avatarPath.trim())) return `/api/avatars/${avatarPath.trim()}`;
  return avatarPath.startsWith("/api/avatars/") ? avatarPath : null;
}

/** Options pour les cookies de session. Secure=true quand l'app est servie en HTTPS. */
export function getCookieOptions() {
  const secure =
    process.env.VERCEL === "1" ||
    process.env.SECURE_COOKIE === "true" ||
    (process.env.NODE_ENV === "production" && process.env.NEXTAUTH_URL?.startsWith("https://"));
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    maxAge: EXPIRES_IN,
    path: "/",
  };
}
