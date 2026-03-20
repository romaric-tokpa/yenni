"use client";
import { SWRConfig } from "swr";
import { usePathname } from "next/navigation";
import { BudgetProvider, useBudgetContext } from "@/contexts/BudgetContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import PageTransition from "@/components/PageTransition";
import Toast from "@/components/ui/Toast";
import NotificationBell from "@/components/NotificationBell";
import { Loader2 } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { getPageTitle } from "@/lib/pageTitles";

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { dailyBudget, loading, toast, showToast, dismissToast } = useBudgetContext();
  const { user, loading: authLoading, logout } = useAuth();
  const pageTitle = getPageTitle(pathname);

  if (authLoading || loading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 bg-[var(--bg-primary)]">
        <div className="w-full max-w-xs space-y-4 text-center">
          <img src="/api/logo" alt="Yenni" className="w-14 h-14 mx-auto opacity-90 drop-shadow-lg" width={56} height={56} />
          <div className="space-y-2">
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mx-auto w-3/4">
              <div className="h-full w-1/2 rounded-full bg-emerald-500/60 animate-pulse" style={{ animationDuration: "1.2s" }} />
            </div>
            <p className="text-sm text-neutral-500">Chargement de tes données…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[var(--bg-primary)]">
        <Loader2 size={28} className="text-emerald-500 animate-spin" aria-hidden />
        <span className="sr-only">Vérification de la session</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-[100dvh]">
      {toast && <Toast message={toast.msg} type={toast.type} onDismiss={dismissToast} />}
      <Sidebar dailyBudget={dailyBudget} user={user} onLogout={logout} />
      <BottomNav dailyBudget={dailyBudget} user={user} onLogout={logout} />
      <div className="flex-1 flex flex-col lg:max-h-screen overflow-hidden">
        <a
          href="#contenu-principal"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-emerald-600 focus:text-white focus:font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          Aller au contenu
        </a>
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 min-h-[52px] py-2 px-4 lg:px-6 border-b border-white/[0.06] shrink-0 bg-[var(--bg-primary)]/85 backdrop-blur-xl backdrop-saturate-150 safe-top supports-[backdrop-filter]:bg-[var(--bg-primary)]/72">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar avatarPath={user.avatar_path} firstName={user.first_name} lastName={user.last_name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-neutral-500 uppercase tracking-wide truncate hidden sm:block">
                {user.first_name}
              </p>
              <h1 className="text-sm sm:text-base font-semibold text-neutral-100 truncate leading-tight">{pageTitle}</h1>
            </div>
          </div>
          <NotificationBell showToast={showToast} />
        </header>
        <main
          id="contenu-principal"
          tabIndex={-1}
          className="flex-1 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8 lg:px-6 pt-4 lg:pt-5 overflow-y-auto outline-none w-full"
        >
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}

const swrConfig = {
  dedupingInterval: 5000,
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  errorRetryCount: 2,
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={swrConfig}>
      <AuthProvider>
        <BudgetProvider>
          <AppShell>{children}</AppShell>
        </BudgetProvider>
      </AuthProvider>
    </SWRConfig>
  );
}
