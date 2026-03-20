"use client";

import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { useBudgetContext } from "@/contexts/BudgetContext";
import type { ModalType } from "@/lib/modal";

function ModalLoadFallback() {
  return (
    <div className="flex min-h-[120px] items-center justify-center text-sm text-neutral-400">
      Chargement…
    </div>
  );
}

const loadFallback = () => <ModalLoadFallback />;

const ModalNewExpense = dynamic(() => import("@/components/modals/ModalNewExpense"), {
  ssr: false,
  loading: loadFallback,
});
const ModalPlanExpense = dynamic(() => import("@/components/modals/ModalPlanExpense"), {
  ssr: false,
  loading: loadFallback,
});
const ModalNewWishList = dynamic(() => import("@/components/modals/ModalNewWishList"), {
  ssr: false,
  loading: loadFallback,
});
const ModalNewWishItem = dynamic(() => import("@/components/modals/ModalNewWishItem"), {
  ssr: false,
  loading: loadFallback,
});
const ModalPurchaseWish = dynamic(() => import("@/components/modals/ModalPurchaseWish"), {
  ssr: false,
  loading: loadFallback,
});
const ModalNewShoppingList = dynamic(() => import("@/components/modals/ModalNewShoppingList"), {
  ssr: false,
  loading: loadFallback,
});
const ModalNewShoppingItem = dynamic(() => import("@/components/modals/ModalNewShoppingItem"), {
  ssr: false,
  loading: loadFallback,
});
const ModalPurchaseShopping = dynamic(() => import("@/components/modals/ModalPurchaseShopping"), {
  ssr: false,
  loading: loadFallback,
});
const ModalNewIncome = dynamic(() => import("@/components/modals/ModalNewIncome"), {
  ssr: false,
  loading: loadFallback,
});
const ModalQuickTransfer = dynamic(() => import("@/components/modals/ModalQuickTransfer"), {
  ssr: false,
  loading: loadFallback,
});

export default function ModalPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const budget = useBudgetContext();
  const type = (searchParams.get("type") || "") as ModalType;
  const returnTo = searchParams.get("returnTo") || "/dashboard";

  const handleClose = () => {
    router.push(returnTo);
  };

  const renderContent = () => {
    switch (type) {
      case "new-expense":
        return <ModalNewExpense onClose={handleClose} budget={budget} />;
      case "plan-expense":
        return <ModalPlanExpense onClose={handleClose} budget={budget} />;
      case "new-wish-list":
        return <ModalNewWishList onClose={handleClose} budget={budget} />;
      case "new-wish-item":
        return (
          <ModalNewWishItem
            onClose={handleClose}
            budget={budget}
            listId={searchParams.get("listId") ?? ""}
            listName={searchParams.get("listName") ?? ""}
          />
        );
      case "purchase-wish":
        return (
          <ModalPurchaseWish
            onClose={handleClose}
            budget={budget}
            listId={searchParams.get("listId") ?? ""}
            itemId={searchParams.get("itemId") ?? ""}
          />
        );
      case "new-shopping-list":
        return <ModalNewShoppingList onClose={handleClose} budget={budget} />;
      case "new-shopping-item":
        return (
          <ModalNewShoppingItem
            onClose={handleClose}
            budget={budget}
            listId={searchParams.get("listId") ?? ""}
            listName={searchParams.get("listName") ?? ""}
          />
        );
      case "purchase-shopping":
        return (
          <ModalPurchaseShopping
            onClose={handleClose}
            budget={budget}
            listId={searchParams.get("listId") ?? ""}
            itemId={searchParams.get("itemId") ?? ""}
          />
        );
      case "new-income":
        return <ModalNewIncome onClose={handleClose} budget={budget} />;
      case "quick-transfer":
        return <ModalQuickTransfer onClose={handleClose} budget={budget} />;
      default:
        return null;
    }
  };

  const content = renderContent();
  if (!content) {
    router.replace(returnTo);
    return null;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" onClick={handleClose}>
      <div
        className="w-full max-w-md rounded-2xl popup-panel p-6 sm:p-8 max-h-[90dvh] overflow-y-auto shadow-2xl flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </div>
  );
}
