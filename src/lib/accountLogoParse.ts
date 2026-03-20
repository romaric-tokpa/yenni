import { MAX_ACCOUNT_LOGO_BYTES } from "./accountLogoShared";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const FETCH_TIMEOUT_MS = 12_000;

/** Valide une data URI image pour stockage en base (côté serveur uniquement). */
export function parseAccountLogoDataUri(
  input: string | null | undefined,
): { ok: true; dataUri: string } | { ok: false; error: string } {
  if (input == null || String(input).trim() === "") {
    return { ok: true, dataUri: "" };
  }
  const s = String(input).trim();
  const match = s.match(/^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) {
    return { ok: false, error: "Logo invalide (image JPG, PNG, WebP ou GIF attendue)" };
  }
  const mime = match[1].toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return { ok: false, error: "Format non supporté (JPG, PNG, WebP, GIF uniquement)" };
  }
  const b64 = match[2].replace(/\s/g, "");
  let decodedLength: number;
  try {
    decodedLength = Buffer.from(b64, "base64").length;
  } catch {
    return { ok: false, error: "Image logo illisible" };
  }
  if (decodedLength > MAX_ACCOUNT_LOGO_BYTES) {
    return { ok: false, error: "Logo trop volumineux (max 400 Ko)" };
  }
  const prefix =
    mime === "image/png"
      ? "data:image/png;base64,"
      : mime === "image/webp"
        ? "data:image/webp;base64,"
        : mime === "image/gif"
          ? "data:image/gif;base64,"
          : "data:image/jpeg;base64,";
  return { ok: true, dataUri: `${prefix}${b64}` };
}

function isBlockedHostname(hostRaw: string): boolean {
  const host = hostRaw.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "0.0.0.0") return true;
  if (host.endsWith(".local")) return true;

  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const c = Number(m[3]);
    const d = Number(m[4]);
    if ([a, b, c, d].some((n) => n > 255)) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

/** URL HTTPS uniquement, sans réseaux privés / loopback (limitation SSRF). */
export function isSafePublicHttpsUrl(urlString: string): boolean {
  let u: URL;
  try {
    u = new URL(urlString);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (!u.hostname || isBlockedHostname(u.hostname)) return false;
  if (u.username || u.password) return false;
  return true;
}

function detectImageMimeFromMagic(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "image/gif";
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

async function fetchHttpsLogoAsDataUri(
  urlString: string,
): Promise<{ ok: true; dataUri: string } | { ok: false; error: string }> {
  if (!isSafePublicHttpsUrl(urlString)) {
    return { ok: false, error: "URL non autorisée (HTTPS public uniquement)" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(urlString, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "image/jpeg,image/png,image/webp,image/gif;q=0.9,*/*;q=0.1",
        "User-Agent": "MonBudget/1.0 (logo import)",
      },
      cache: "no-store",
    });

    const finalUrl = res.url;
    if (!isSafePublicHttpsUrl(finalUrl)) {
      return { ok: false, error: "Redirection vers une URL non autorisée" };
    }

    if (!res.ok) {
      return { ok: false, error: "Impossible de télécharger l’image (lien invalide ou expiré)" };
    }

    const lenHdr = res.headers.get("content-length");
    if (lenHdr) {
      const n = parseInt(lenHdr, 10);
      if (!Number.isNaN(n) && n > MAX_ACCOUNT_LOGO_BYTES) {
        return { ok: false, error: "Image trop volumineuse (max 400 Ko)" };
      }
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_ACCOUNT_LOGO_BYTES) {
      return { ok: false, error: "Image trop volumineuse (max 400 Ko)" };
    }
    if (buf.length === 0) {
      return { ok: false, error: "Fichier image vide" };
    }

    const magicMime = detectImageMimeFromMagic(buf);
    if (!magicMime || !ALLOWED_MIME.has(magicMime)) {
      return { ok: false, error: "Le fichier n’est pas une image JPG, PNG, WebP ou GIF" };
    }
    const b64 = buf.toString("base64");
    const prefix =
      magicMime === "image/png"
        ? "data:image/png;base64,"
        : magicMime === "image/webp"
          ? "data:image/webp;base64,"
          : magicMime === "image/gif"
            ? "data:image/gif;base64,"
            : "data:image/jpeg;base64,";
    return { ok: true, dataUri: `${prefix}${b64}` };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "Délai dépassé en téléchargeant l’image" };
    }
    return { ok: false, error: "Impossible de récupérer l’image depuis cette URL" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Data URI (upload) ou URL https publique — retourne toujours une data URI normalisée pour la base.
 */
export async function resolveAccountLogoInput(
  input: string | null | undefined,
): Promise<{ ok: true; dataUri: string } | { ok: false; error: string }> {
  if (input == null || String(input).trim() === "") {
    return { ok: true, dataUri: "" };
  }
  const s = String(input).trim();
  if (s.startsWith("data:")) {
    return parseAccountLogoDataUri(s);
  }
  if (s.startsWith("https://")) {
    return fetchHttpsLogoAsDataUri(s);
  }
  return {
    ok: false,
    error: "Utilise une URL commençant par https:// ou importe un fichier",
  };
}
