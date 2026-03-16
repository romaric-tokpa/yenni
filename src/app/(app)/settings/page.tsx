"use client";
import { useBudgetContext } from "@/contexts/BudgetContext";
import Settings from "@/components/Settings";
import ProfileSection from "@/components/ProfileSection";

export default function SettingsPage() {
  const { showToast, ...budget } = useBudgetContext();
  return (
    <div>
      <ProfileSection showToast={showToast} />
      <Settings budget={budget} showToast={showToast} />
    </div>
  );
}
