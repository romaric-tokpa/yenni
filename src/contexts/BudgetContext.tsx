"use client";
import { createContext, useContext, useState, ReactNode } from "react";
import { useBudget } from "@/hooks/useBudget";

type BudgetReturn = ReturnType<typeof useBudget>;

interface ToastState {
  msg: string;
  type: string;
}

interface BudgetContextValue extends BudgetReturn {
  toast: ToastState | null;
  showToast: (msg: string, type?: string) => void;
  dismissToast: () => void;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

export function BudgetProvider({ children }: { children: ReactNode }) {
  const budget = useBudget();
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
  };

  const dismissToast = () => setToast(null);

  return (
    <BudgetContext.Provider value={{ ...budget, toast, showToast, dismissToast }}>
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudgetContext() {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error("useBudgetContext must be used within BudgetProvider");
  return ctx;
}
