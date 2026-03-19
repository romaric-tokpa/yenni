"use client";
import { useBudgetContext } from "@/contexts/BudgetContext";
import ShoppingListsView from "@/components/ShoppingListsView";

export default function ShoppingListsPage() {
  const { config, showToast, fetchExpenses, invalidateHistoryCache } = useBudgetContext();
  return (
    <ShoppingListsView
      config={config}
      showToast={showToast}
      onPurchaseComplete={() => {
        fetchExpenses();
        invalidateHistoryCache();
      }}
    />
  );
}
