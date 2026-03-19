"use client";

import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] px-4">
      <div className="glass-strong rounded-2xl p-8 sm:p-10 max-w-md w-full text-center animate-slide-up">
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <WifiOff size={40} className="text-amber-400" strokeWidth={1.5} />
          </div>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-200 mb-2">
          Hors ligne
        </h1>
        <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
          Vous n&apos;êtes pas connecté. Vérifiez votre connexion internet et réessayez.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-8 w-full btn-primary py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-95 active:scale-[0.98]"
        >
          <RefreshCw size={18} strokeWidth={2.5} />
          Réessayer
        </button>
      </div>
    </div>
  );
}
