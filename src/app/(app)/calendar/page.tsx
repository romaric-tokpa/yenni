"use client";
import { useBudgetContext } from "@/contexts/BudgetContext";
import CalendarView from "@/components/CalendarView";

export default function CalendarPage() {
  const { showToast, ...budget } = useBudgetContext();
  return <CalendarView budget={budget} showToast={showToast} />;
}
