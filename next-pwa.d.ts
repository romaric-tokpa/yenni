declare module "next-pwa" {
  import type { NextConfig } from "next";
  function withPWA(config?: Record<string, unknown>): (nextConfig: NextConfig) => NextConfig;
  export default withPWA;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
