"use client";

import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: boolean }).MSStream;

    setIsStandalone(standalone || !!iosStandalone);
    setIsIOS(isIOSDevice);

    if (standalone || iosStandalone) return;

    const handler = (e: Event) => {
      const dismissed = sessionStorage.getItem("yenni-install-dismissed");
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!dismissed) {
        e.preventDefault();
        setShowBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setShowBanner(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem("yenni-install-dismissed", "true");
  };

  if (!showBanner || isStandalone) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm animate-[slideUp_0.4s_ease_forwards]">
      <div className="rounded-xl popup-panel shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-100 text-sm">Installer Yenni</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {isIOS
                ? "Appuyez sur Partager puis « Ajouter à l’écran d’accueil »"
                : "Utilisez l’app hors ligne, comme une application native."}
            </p>
            <div className="flex gap-2 mt-3">
              {!isIOS && deferredPrompt && (
                <button
                  onClick={handleInstall}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors"
                >
                  Installer
                </button>
              )}
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-sm transition-colors"
              >
                Plus tard
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors shrink-0"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
