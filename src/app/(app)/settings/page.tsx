"use client";
import { useBudgetContext } from "@/contexts/BudgetContext";
import Settings from "@/components/Settings";

export default function SettingsPage() {
  const { showToast, ...budget } = useBudgetContext();
  return <Settings budget={budget} showToast={showToast} />;
}
