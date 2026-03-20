import AppLayoutClient from "./AppLayoutClient";

/**
 * Server Component : évite que tout le segment (app) soit marqué « client »,
 * ce qui réduit les avertissements Chrome « preload CSS not used » liés au routeur RSC.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppLayoutClient>{children}</AppLayoutClient>;
}
