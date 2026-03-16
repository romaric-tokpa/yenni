"use client";
import { useBudgetContext } from "@/contexts/BudgetContext";
import ProjectsView from "@/components/ProjectsView";

export default function ProjectsPage() {
  const { showToast, ...budget } = useBudgetContext();
  return <ProjectsView budget={budget} showToast={showToast} />;
}
