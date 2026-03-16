import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: true,
  reloadOnOnline: true,
});

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {}, // Silencie l'avertissement : next-pwa ajoute webpack, mais en dev la PWA est désactivée
  webpack: (config, { dev, isServer }) => {
    // Désactive le cache webpack en dev pour éviter les erreurs ENOENT (fichiers manquants)
    if (dev) config.cache = false;
    return config;
  },
};

export default withPWA(nextConfig);
