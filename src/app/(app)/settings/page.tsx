"use client";
import dynamic from "next/dynamic";
import { useBudgetContext } from "@/contexts/BudgetContext";

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
      <Settings budget={budget} showToast={showToast} />
      <div className="mt-4 lg:mt-5">
        <BackupSection showToast={showToast} />
      </div>
    </div>
  );
}
