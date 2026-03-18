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
  const { dailyBudget, loading, toast, showToast, dismissToast } = useBudgetContext();
  const { user, loading: authLoading, logout } = useAuth();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <img src="/api/logo" alt="Yenni" className="w-12 h-12 mx-auto mb-3 opacity-80" />
          <div className="text-sm text-neutral-500">Chargement...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="text-green-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      {toast && <Toast message={toast.msg} type={toast.type} onDismiss={dismissToast} />}
      <Sidebar dailyBudget={dailyBudget} user={user} onLogout={logout} />
      <BottomNav dailyBudget={dailyBudget} user={user} onLogout={logout} />
      <div className="flex-1 flex flex-col lg:max-h-screen overflow-hidden">
        <header className="sticky top-0 z-40 flex justify-between items-center h-12 px-4 lg:px-6 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar avatarPath={user.avatar_path} firstName={user.first_name} lastName={user.last_name} size="sm" />
            <p className="text-sm font-medium text-neutral-200 truncate hidden sm:block">{user.first_name}</p>
          </div>
          <NotificationBell showToast={showToast} />
        </header>
        <main className="flex-1 px-4 pb-20 lg:pb-6 lg:px-6 pt-4 overflow-y-auto">
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
