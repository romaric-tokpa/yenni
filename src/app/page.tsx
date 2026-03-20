"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LandingPage from "@/components/LandingPage";

export default function Home() {
  const router = useRouter();
  const [phase, setPhase] = useState<"checking" | "landing">("checking");

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => {
        if (r.ok) return r.json();
        return null;
      })
      .then((data) => {
        if (data?.user) {
          router.replace("/dashboard");
          return;
        }
        setPhase("landing");
      })
      .catch(() => {
        setPhase("landing");
      });
  }, [router]);

  if (phase === "checking") {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[var(--bg-primary)] px-4">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/api/logo" alt="" className="h-16 w-16 animate-pulse opacity-90" width={64} height={64} />
          </div>
          <div className="font-mono text-lg text-emerald-400">Yenni</div>
          <div className="mt-2 text-sm text-neutral-500">Chargement…</div>
        </div>
      </div>
    );
  }

  return <LandingPage />;
}
