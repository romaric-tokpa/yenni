"use client";
import { useBudgetContext } from "@/contexts/BudgetContext";
import WishesView from "@/components/WishesView";

export default function WishesPage() {
  const { config, showToast, updateConfig, fetchExpenses, invalidateHistoryCache } = useBudgetContext();
  return (
    <WishesView
      config={config}
      showToast={showToast}
      updateConfig={updateConfig}
      onPurchaseComplete={() => {
        fetchExpenses();
        invalidateHistoryCache();
      }}
    />
  );
}
