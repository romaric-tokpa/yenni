/** Photos des envies : tableau de data URLs stocké en JSON (colonne photos_json). */

export const MAX_WISH_ITEM_PHOTOS = 6;

export function parseWishItemPhotos(item: { photos_json?: string | null }): string[] {
  if (!item.photos_json || String(item.photos_json).trim() === "") return [];
  try {
    const p = JSON.parse(String(item.photos_json));
    if (!Array.isArray(p)) return [];
    return p.filter((x): x is string => typeof x === "string" && x.startsWith("data:image/"));
  } catch {
    return [];
  }
}

/** Normalise le corps API (photos[] ou photos_json) vers une chaîne JSON pour la BDD. */
export function normalizePhotosJson(photos: unknown, photos_json?: unknown): string {
  if (Array.isArray(photos)) {
    const arr = photos
      .filter((x) => typeof x === "string" && (x as string).startsWith("data:image/"))
      .slice(0, MAX_WISH_ITEM_PHOTOS);
    return JSON.stringify(arr);
  }
  if (typeof photos_json === "string" && photos_json.trim()) {
    try {
      const p = JSON.parse(photos_json);
      if (Array.isArray(p)) {
        return JSON.stringify(
          p.filter((x) => typeof x === "string" && (x as string).startsWith("data:image/")).slice(0, MAX_WISH_ITEM_PHOTOS),
        );
      }
    } catch {
      /* ignore */
    }
  }
  return "[]";
}
