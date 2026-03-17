import path from "path";
import fs from "fs";

/** Répertoire principal des avatars (data/ pour persistance Docker) */
export const AVATARS_DIR = path.join(process.cwd(), "data", "uploads", "avatars");

/** Ancien emplacement (fallback pour migration) */
const LEGACY_AVATARS_DIR = path.join(process.cwd(), "public", "uploads", "avatars");

/** Chemin du fichier avatar (data d'abord, puis legacy) */
export function getAvatarFilePath(filename: string): string {
  const dataPath = path.join(AVATARS_DIR, filename);
  if (!process.env.TURSO_DATABASE_URL && fs.existsSync(dataPath)) return dataPath;
  return path.join(LEGACY_AVATARS_DIR, filename);
}
