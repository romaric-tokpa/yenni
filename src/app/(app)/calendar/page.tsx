"use client";
import dynamic from "next/dynamic";
import { useBudgetContext } from "@/contexts/BudgetContext";

const CalendarView = dynamic(() => import("@/components/CalendarView"), {
  loading: () => <div className="animate-pulse h-64 rounded-2xl bg-white/5" />,
});

export default function CalendarPage() {
  const { showToast, ...budget } = useBudgetContext();
  return <CalendarView budget={budget} showToast={showToast} />;
}
