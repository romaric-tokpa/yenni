import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Yenni — Gestion Financière",
    short_name: "Yenni",
    description: "Application de gestion budgétaire personnelle",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0e1a",
    theme_color: "#10b981",
    orientation: "portrait-primary",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
