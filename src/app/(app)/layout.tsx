"use client";
import { BudgetProvider, useBudgetContext } from "@/contexts/BudgetContext";
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/ui/Toast";
import { Gem } from "lucide-react";

function AppShell({ children }: { children: React.ReactNode }) {
  const { dailyBudget, loading, toast } = useBudgetContext();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 animate-pulse flex justify-center">
            <Gem size={48} className="text-violet-400" />
          </div>
          <div className="font-mono text-lg text-violet-400">MonBudget</div>
          <div className="text-sm text-slate-500 mt-2">Chargement...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      {toast && <Toast message={toast.msg} type={toast.type} />}
      <Sidebar dailyBudget={dailyBudget} />
      <main className="flex-1 px-4 pt-14 pb-6 lg:pt-8 lg:p-8 overflow-y-auto lg:max-h-screen">
        {children}
      </main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <BudgetProvider>
      <AppShell>{children}</AppShell>
    </BudgetProvider>
  );
}
