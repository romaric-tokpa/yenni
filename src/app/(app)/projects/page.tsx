"use client";
import dynamic from "next/dynamic";
import { useBudgetContext } from "@/contexts/BudgetContext";

const ProjectsView = dynamic(() => import("@/components/ProjectsView"), {
  loading: () => <div className="animate-pulse h-64 rounded-2xl bg-white/5" />,
});

export default function ProjectsPage() {
  const { showToast, ...budget } = useBudgetContext();
  return <ProjectsView budget={budget} showToast={showToast} />;
}
