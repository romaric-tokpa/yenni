"use client";
import { SWRConfig } from "swr";
import { BudgetProvider, useBudgetContext } from "@/contexts/BudgetContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import PageTransition from "@/components/PageTransition";
import Toast from "@/components/ui/Toast";
import NotificationBell from "@/components/NotificationBell";
import { Loader2 } from "lucide-react";
import Avatar from "@/components/ui/Avatar";

function AppShell({ children }: { children: React.ReactNode }) {
  const { dailyBudget, loading, toast, showToast } = useBudgetContext();
  const { user, loading: authLoading, logout } = useAuth();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 animate-pulse flex justify-center">
            <img src="/api/logo" alt="Yenni" className="w-16 h-16" />
          </div>
          <div className="font-mono text-lg text-emerald-400">Yenni</div>
          <div className="text-sm text-slate-500 mt-2">Chargement...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      {toast && <Toast message={toast.msg} type={toast.type} />}
      <Sidebar dailyBudget={dailyBudget} user={user} onLogout={logout} />
      <BottomNav dailyBudget={dailyBudget} user={user} onLogout={logout} />
      <div className="flex-1 flex flex-col lg:max-h-screen overflow-hidden">
        <header className="sticky top-0 z-40 flex justify-between items-center min-h-[52px] h-14 lg:h-auto px-4 lg:pt-4 lg:px-8 lg:pb-3 bg-[var(--bg-primary)]/80 backdrop-blur-sm border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar avatarPath={user.avatar_path} firstName={user.first_name} lastName={user.last_name} size="md" />
            <div className="min-w-0 hidden sm:block">
              <p className="text-sm font-semibold text-slate-200 truncate">{user.first_name} {user.last_name}</p>
              <p className="text-[10px] text-slate-500 truncate">Bienvenue</p>
            </div>
          </div>
          <NotificationBell showToast={showToast} />
        </header>
        <main className="flex-1 px-4 pt-2 pb-24 lg:pb-8 lg:pt-4 lg:px-8 overflow-y-auto">
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
