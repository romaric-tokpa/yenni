import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
    // Réduit les warnings "preloaded but not used" pour layout.css en dev
    cssChunking: false,
  },
  serverExternalPackages: ["@libsql/client"],
  turbopack: {},
  productionBrowserSourceMaps: false,
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
      // Évite les 404 pour les source maps manquantes (ex: framer-motion LayoutGroupContext.mjs.map)
      // "eval" n'émet pas de fichiers .map externes — tout est inline, pas de requêtes 404
      config.devtool = "eval";
    }
    return config;
  },
};

export default nextConfig;
