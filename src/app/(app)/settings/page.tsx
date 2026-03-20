"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useBudgetContext } from "@/contexts/BudgetContext";
import { Wallet, ChevronRight } from "lucide-react";

const Settings = dynamic(() => import("@/components/Settings"), {
  loading: () => <div className="animate-pulse h-32 rounded-2xl bg-white/5" />,
});
const ProfileSection = dynamic(() => import("@/components/ProfileSection"), {
  loading: () => <div className="animate-pulse h-24 rounded-2xl bg-white/5" />,
});
const BackupSection = dynamic(() => import("@/components/BackupSection"), {
  loading: () => <div className="animate-pulse h-24 rounded-2xl bg-white/5" />,
});

export default function SettingsPage() {
  const { showToast, ...budget } = useBudgetContext();
  return (
    <div>
      <ProfileSection showToast={showToast} />

      <Link
        href="/settings/accounts"
        className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4 mb-4 lg:mb-5 hover:bg-white/[0.04] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
            <Wallet className="text-emerald-400" size={20} />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-neutral-100">Comptes</div>
            <div className="text-xs text-neutral-500 truncate">
              Mobile Money, cartes, espèces, banque et transferts entre comptes
            </div>
          </div>
        </div>
        <ChevronRight className="text-neutral-500 shrink-0" size={20} />
      </Link>

      <Settings budget={budget} showToast={showToast} />
      <div className="mt-4 lg:mt-5">
        <BackupSection showToast={showToast} />
      </div>
    </div>
  );
}
