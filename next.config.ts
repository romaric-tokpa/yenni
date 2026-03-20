import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
  serverExternalPackages: ["@libsql/client"],
  turbopack: {},
  productionBrowserSourceMaps: false,
  webpack: (config, { dev }) => {
    if (dev) {
      // Ne pas désactiver le cache : rebuilds trop lentes → chunks servis en retard → ChunkLoadError (timeout).
      // Évite les 404 pour les source maps manquantes (ex: framer-motion LayoutGroupContext.mjs.map)
      // "eval" n'émet pas de fichiers .map externes — tout est inline, pas de requêtes 404
      config.devtool = "eval";
    }
    return config;
  },
};

export default nextConfig;
