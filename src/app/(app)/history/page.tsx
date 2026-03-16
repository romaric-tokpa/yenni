"use client";
import dynamic from "next/dynamic";

const HistoryView = dynamic(() => import("@/components/HistoryView"), {
  loading: () => <div className="animate-pulse h-64 rounded-2xl bg-white/5" />,
});

export default function HistoryPage() {
  return <HistoryView />;
}
