import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import InstallPrompt from "@/components/InstallPrompt";
import PWARegister from "@/components/PWARegister";

export const metadata: Metadata = {
  title: "Yenni — Gestion Financière",
  description: "Application de suivi budgétaire personnel. Fonctionne hors ligne.",
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
    apple: "/logo.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0e1a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {children}
        <InstallPrompt />
        <PWARegister />
        <Analytics />
      </body>
    </html>
  );
}
