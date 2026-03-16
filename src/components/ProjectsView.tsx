"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { formatCFA } from "@/lib/constants";
import { Plus, X, Trash2, Pause, Play, CheckCircle, Target, Pencil, Check, Lightbulb, Receipt, History, ChevronDown, ChevronUp, ShoppingCart } from "lucide-react";
import { Project, ProjectFund, ProjectPurchase, BudgetConfig, Category } from "@/lib/types";
import Icon from "./ui/Icon";
import AnimatedProgressBar from "./ui/AnimatedProgressBar";
import { useConfetti } from "@/hooks/useConfetti";
import { PROJECT_ICON_NAMES } from "./ui/Icon";
import {
  monthsUntilDeadline,
  monthlySavingsNeeded,
  getFeasibility,
  getFeasibilityLabel,
  getFeasibilityColor,
} from "@/lib/goalUtils";

const PROJECT_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#f97316",
];

interface BudgetData {
  config: BudgetConfig;
  projects: Project[];
  resteAVivre: number;
  soldeNet?: number;
  monthProjectFunds?: number;
  selectedMonth?: number;
  selectedYear?: number;
  addProject: (p: Omit<Project, "id" | "created_at">) => Promise<boolean>;
  updateProject: (id: number, updates: Partial<Project>) => Promise<void>;
  removeProject: (id: number) => Promise<void>;
  fetchProjects: () => Promise<void>;
  fetchMonthProjectFunds?: () => Promise<void>;
  addToMonthProjectFunds?: (amount: number, fundDate: string) => void;
  fetchConfig?: () => Promise<void>;
  fetchExpenses?: () => Promise<void>;
  updateConfig?: (config: BudgetConfig) => Promise<void>;
  addExpense: (exp: { date: string; time: string; description: string; category: string; amount: number; notes: string }) => Promise<boolean>;
  invalidateHistoryCache?: () => void;
}

export default function ProjectsView({
  budget,
  showToast,
}: {
  budget: BudgetData;
  showToast: (m: string, t?: string) => void;
}) {
  const { config, projects, resteAVivre, soldeNet, monthProjectFunds, selectedMonth, selectedYear, addProject, updateProject, removeProject, fetchProjects, fetchMonthProjectFunds, addToMonthProjectFunds, updateConfig, fetchConfig, fetchExpenses, addExpense, invalidateHistoryCache } = budget;
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [realizingProject, setRealizingProject] = useState<Project | null>(null);
  const formDefault = {
    name: "", description: "", target_amount: "", deadline: "",
    icon: "target", color: "#6366f1", status: "active" as Project["status"], saved_amount: 0,
  };
  const [form, setForm] = useState(formDefault);
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [addAmount, setAddAmount] = useState("");
  const [addFundDate, setAddFundDate] = useState(new Date().toISOString().split("T")[0]);
  const [projectFunds, setProjectFunds] = useState<Record<number, ProjectFund[]>>({});
  const [expandedFunds, setExpandedFunds] = useState<Set<number>>(new Set());
  const [editingFund, setEditingFund] = useState<ProjectFund | null>(null);
  const [editFundAmount, setEditFundAmount] = useState("");
  const [editFundDate, setEditFundDate] = useState("");
  const [projectPurchases, setProjectPurchases] = useState<Record<number, ProjectPurchase[]>>({});
  const [expandedPurchases, setExpandedPurchases] = useState<Set<number>>(new Set());
  const [addingPurchaseTo, setAddingPurchaseTo] = useState<number | null>(null);
  const [purchaseForm, setPurchaseForm] = useState({ description: "", amount: "", date: "" });
  const fireConfetti = useConfetti();

  const fetchProjectFunds = useCallback(async (projectId: number) => {
    try {
      const r = await fetch(`/api/projects/${projectId}/funds`);
      if (r.ok) {
        const funds = await r.json();
        setProjectFunds((prev) => ({ ...prev, [projectId]: funds }));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    projects.forEach((p) => fetchProjectFunds(p.id));
  }, [projects, fetchProjectFunds]);

  const fetchProjectPurchases = useCallback(async (projectId: number) => {
    try {
      const r = await fetch(`/api/projects/${projectId}/purchases`);
      if (r.ok) {
        const purchases = await r.json();
        setProjectPurchases((prev) => ({ ...prev, [projectId]: purchases }));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    projects.filter((p) => p.status === "completed").forEach((p) => fetchProjectPurchases(p.id));
  }, [projects, fetchProjectPurchases]);

  const toggleFunds = (projectId: number) => {
    setExpandedFunds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const addProjectFund = async (projectId: number, amount: number, date: string) => {
    try {
      const r = await fetch(`/api/projects/${projectId}/funds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, date }),
      });
      if (r.ok) {
        await fetchProjectFunds(projectId);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const updateProjectFundAmount = async (fund: ProjectFund, newAmount: number, newDate: string) => {
    try {
      const r = await fetch(`/api/projects/${fund.project_id}/funds`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: fund.id, amount: newAmount, date: newDate }),
      });
      if (r.ok) {
        await fetchProjectFunds(fund.project_id);
        await fetchProjects();
        if (fetchMonthProjectFunds) await fetchMonthProjectFunds();
        setEditingFund(null);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const removeProjectFund = async (fund: ProjectFund) => {
    try {
      const r = await fetch(`/api/projects/${fund.project_id}/funds?id=${fund.id}`, { method: "DELETE" });
      if (r.ok) {
        await fetchProjectFunds(fund.project_id);
        await fetchProjects();
        if (fetchMonthProjectFunds) await fetchMonthProjectFunds();
        invalidateHistoryCache?.();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const openEditModal = (p: Project) => {
    setEditingProject(p);
    setForm({
      name: p.name,
      description: p.description,
      target_amount: String(p.target_amount),
      deadline: p.deadline || "",
      icon: p.icon,
      color: p.color,
      status: p.status,
      saved_amount: p.saved_amount,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProject(null);
    setForm(formDefault);
  };

  const handleSave = async () => {
    if (!form.name || !form.target_amount) { showToast("Nom et montant requis", "error"); return; }
    if (editingProject) {
      await updateProject(editingProject.id, {
        name: form.name,
        description: form.description,
        target_amount: Number(form.target_amount),
        deadline: form.deadline,
        icon: form.icon,
        color: form.color,
      });
      showToast("Projet modifié !");
    } else {
      await addProject({ ...form, target_amount: Number(form.target_amount), saved_amount: 0 });
      showToast("Projet créé !");
    }
    closeModal();
  };

  const handleAddFunds = async (p: Project) => {
    const amt = Number(addAmount);
    if (!amt || amt <= 0) return;
    const ok = await addProjectFund(p.id, amt, addFundDate);
    if (ok) {
      const newTotal = p.saved_amount + amt;
      const wasReached = p.saved_amount >= p.target_amount;
      if (!wasReached && newTotal >= p.target_amount && p.target_amount > 0) {
        fireConfetti();
        showToast(`Objectif atteint ! 🎉 ${p.name}`);
      } else {
        showToast(`${formatCFA(amt)} FCFA ajoutés à ${p.name}`);
      }
      setAddingTo(null);
      setAddAmount("");
      addToMonthProjectFunds?.(amt, addFundDate);
      await fetchProjects();
      await fetchProjectFunds(p.id);
      if (fetchMonthProjectFunds) await fetchMonthProjectFunds();
      invalidateHistoryCache?.();
    }
  };

  const openRealizeModal = (p: Project) => setRealizingProject(p);

  const getProjectCategoryId = (projectId: number) => `proj_${projectId}`;

  const ensureProjectCategory = async (p: Project): Promise<string> => {
    const catId = getProjectCategoryId(p.id);
    const exists = config.categories.some((c) => c.id === catId);
    if (exists) return catId;
    if (!updateConfig) {
      showToast("Impossible de créer la catégorie", "error");
      throw new Error("updateConfig requis");
    }
    const newCat: Category = {
      id: catId,
      label: p.name,
      icon: "target",
      budget: 0,
      color: p.color || "#6366f1",
    };
    const newConfig = { ...config, categories: [...config.categories, newCat] };
    await updateConfig(newConfig);
    if (fetchConfig) await fetchConfig();
    return catId;
  };

  const handleRealizeProject = async () => {
    if (!realizingProject) return;
    try {
      await updateProject(realizingProject.id, { status: "completed" });
      fireConfetti();
      showToast(`${realizingProject.name} — Projet réalisé ! Tu peux suivre les achats au fur et à mesure.`);
      setRealizingProject(null);
    } catch {
      showToast("Erreur lors de la réalisation", "error");
    }
  };

  const handleAddPurchase = async (p: Project) => {
    const desc = purchaseForm.description.trim();
    const amt = Number(purchaseForm.amount);
    if (!desc || !amt || amt <= 0) {
      showToast("Description et montant requis", "error");
      return;
    }
    const purchases = projectPurchases[p.id] || [];
    if (amt > p.saved_amount) {
      showToast(`Dépassement : reste ${formatCFA(p.saved_amount)} FCFA disponible`, "error");
      return;
    }
    try {
      const catId = await ensureProjectCategory(p);
      const date = purchaseForm.date || new Date().toISOString().split("T")[0];
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const expRes = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          time,
          description: desc,
          category: catId,
          amount: amt,
          notes: `Achat projet: ${p.name}`,
        }),
      });
      if (!expRes.ok) {
        showToast("Erreur lors de l'enregistrement de la dépense", "error");
        return;
      }
      const expense = await expRes.json();
      const r = await fetch(`/api/projects/${p.id}/purchases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc, amount: amt, date, expense_id: expense.id }),
      });
      if (r.ok) {
        await fetchProjectPurchases(p.id);
        await fetchProjects();
        if (fetchExpenses) await fetchExpenses();
        invalidateHistoryCache?.();
        setAddingPurchaseTo(null);
        setPurchaseForm({ description: "", amount: "", date: new Date().toISOString().split("T")[0] });
        showToast(`Achat enregistré — ${formatCFA(amt)} en dépense, reste ${formatCFA(p.saved_amount - amt)}`);
      } else {
        const err = await r.json();
        showToast(err?.error || "Erreur", "error");
      }
    } catch {
      showToast("Erreur lors de l'ajout", "error");
    }
  };

  const handleRemovePurchase = async (purchase: ProjectPurchase) => {
    try {
      const r = await fetch(`/api/projects/${purchase.project_id}/purchases?id=${purchase.id}`, { method: "DELETE" });
      if (r.ok) {
        await fetchProjectPurchases(purchase.project_id);
        await fetchProjects();
        if (fetchExpenses) await fetchExpenses();
        invalidateHistoryCache?.();
        showToast("Achat et dépense supprimés");
      }
    } catch {
      showToast("Erreur lors de la suppression", "error");
    }
  };

  const activeProjects = projects.filter((p: Project) => p.status === "active");
  const completedProjects = projects.filter((p: Project) => p.status === "completed");
  const pausedProjects = projects.filter((p: Project) => p.status === "paused");
  const otherProjects = pausedProjects;
  const totalProjectSaved = projects.reduce((s: number, p: Project) => s + p.saved_amount, 0);
  const totalProjectTarget = projects.reduce((s: number, p: Project) => s + p.target_amount, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="flex justify-between items-start mb-5 lg:mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold">Mes Projets</h1>
          <p className="text-slate-500 text-xs lg:text-sm mt-0.5">
            {activeProjects.length} actifs — {formatCFA(totalProjectSaved)} / {formatCFA(totalProjectTarget)} FCFA
            {typeof monthProjectFunds === "number" && monthProjectFunds > 0 && (
              <span className="ml-2 text-amber-400/90">· {formatCFA(monthProjectFunds)} prélevés ce mois</span>
            )}
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="btn-primary px-4 py-2.5 rounded-xl text-xs lg:text-sm font-semibold flex items-center gap-1.5 shrink-0">
          <Plus size={16} /> <span className="hidden sm:inline">Nouveau</span> Projet
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="glass-strong rounded-2xl p-10 lg:p-16 text-center">
          <div className="mb-4 flex justify-center">
            <Target size={48} className="text-emerald-400" />
          </div>
          <div className="text-base lg:text-lg font-semibold mb-2">Aucun projet</div>
          <div className="text-slate-500 text-xs lg:text-sm mb-5">
            Crée ton premier projet d&apos;épargne
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary px-5 py-2.5 rounded-xl text-sm font-semibold">
            Créer un projet
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 mb-5 lg:mb-6">
            {activeProjects.map((p: Project) => {
              const pct = p.target_amount > 0 ? (p.saved_amount / p.target_amount) * 100 : 0;
              const remaining = p.target_amount - p.saved_amount;
              const monthsLeft = p.deadline ? monthsUntilDeadline(p.deadline) : 0;
              const monthlyNeeded = p.deadline && monthsLeft > 0 && remaining > 0
                ? monthlySavingsNeeded(p.target_amount, p.saved_amount, monthsLeft)
                : 0;
              const feasibility = monthlyNeeded > 0 ? getFeasibility(monthlyNeeded, resteAVivre) : null;
              return (
                <motion.div
                  key={p.id}
                  className="glass-strong kpi-card rounded-2xl p-4 lg:p-6"
                  style={{ borderLeft: `4px solid ${p.color}` }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                >
                  <div className="flex justify-between items-start mb-3 lg:mb-4">
                    <div className="flex items-center gap-2 lg:gap-3 min-w-0">
                      <span className="flex items-center justify-center w-10 h-10 lg:w-12 lg:h-12 rounded-xl" style={{ background: p.color + "22" }}>
                        <Icon name={p.icon} size={22} style={{ color: p.color }} />
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm lg:text-base truncate">{p.name}</div>
                        {p.description && <div className="text-[10px] lg:text-xs text-slate-500 mt-0.5 truncate">{p.description}</div>}
                      </div>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <button onClick={() => openEditModal(p)} title="Modifier"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 active:text-emerald-400 transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => updateProject(p.id, { status: "paused" })} title="Mettre en pause"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 active:text-amber-400 transition-colors"><Pause size={14} /></button>
                      <button onClick={() => openRealizeModal(p)} title="Projet réalisé"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 active:text-emerald-400 transition-colors"><CheckCircle size={14} /></button>
                      <button onClick={() => removeProject(p.id)} title="Supprimer"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 active:text-red-400 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="flex justify-between items-end mb-2">
                    <div className="font-mono text-xl lg:text-2xl font-bold" style={{ color: p.color }}>{formatCFA(p.saved_amount)}</div>
                    <div className="text-[10px] lg:text-xs text-slate-400">/ {formatCFA(p.target_amount)}</div>
                  </div>
                  <div className="mb-2 lg:mb-3">
                    <AnimatedProgressBar
                      value={p.saved_amount}
                      max={p.target_amount}
                      gradient={`linear-gradient(90deg,${p.color},${p.color}cc)`}
                      duration={0.9}
                    />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] lg:text-[11px] text-slate-500 mb-3 lg:mb-4">
                    <span>{pct.toFixed(1)}%</span>
                    <span>Reste: {formatCFA(Math.max(remaining, 0))}</span>
                    {p.deadline && <span>{new Date(p.deadline).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}</span>}
                    {monthlyNeeded > 0 && (
                      <span className="flex items-center gap-1">
                        <Lightbulb size={10} className="text-amber-400" />
                        Épargne {formatCFA(monthlyNeeded)}/mois
                      </span>
                    )}
                    {feasibility && (
                      <span className={`font-medium ${getFeasibilityColor(feasibility)}`}>
                        — {getFeasibilityLabel(feasibility)}
                      </span>
                    )}
                  </div>
                  {addingTo === p.id ? (
                    <div className="space-y-2">
                      <p className="text-[10px] text-slate-500">
                        Prélevé du solde disponible (comme l&apos;épargne).
                      </p>
                      <div className="flex gap-2">
                        <input type="number" className="input-field font-mono text-base py-3 min-w-[140px] flex-1" placeholder="Montant"
                          value={addAmount} onChange={(e) => setAddAmount(e.target.value)} autoFocus />
                        <input type="date" className="input-field text-sm py-2 w-32"
                          value={addFundDate} onChange={(e) => setAddFundDate(e.target.value)} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleAddFunds(p)} className="btn-primary px-4 py-2 rounded-lg text-xs font-semibold">OK</button>
                        <button onClick={() => { setAddingTo(null); setAddAmount(""); }}
                          className="px-3 py-2 rounded-lg border border-white/10 text-xs text-slate-400">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button onClick={() => openRealizeModal(p)}
                        className="w-full py-3 rounded-xl text-sm font-semibold bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-300 border-2 border-emerald-500/50 flex items-center justify-center gap-2 transition-colors min-h-[44px]">
                        <Receipt size={18} /> Projet réalisé — Enregistrer en dépense
                      </button>
                      <button onClick={() => setAddingTo(p.id)}
                        className="w-full sm:flex-1 py-2.5 rounded-xl text-xs font-semibold border border-dashed transition-colors flex items-center justify-center gap-1.5"
                        style={{ borderColor: p.color + "66", color: p.color }}>
                        <Plus size={14} /> Ajouter des fonds
                      </button>
                    </div>
                  )}

                  {(projectFunds[p.id]?.length ?? 0) > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <button
                        onClick={() => toggleFunds(p.id)}
                        className="w-full flex items-center justify-between text-[10px] lg:text-xs text-slate-400 hover:text-slate-300 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <History size={12} />
                          Fonds ajoutés ({projectFunds[p.id]?.length ?? 0})
                        </span>
                        {expandedFunds.has(p.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {expandedFunds.has(p.id) && (
                        <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                          {(projectFunds[p.id] || []).map((f) => (
                            <div key={f.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/[0.03]">
                              {editingFund?.id === f.id ? (
                                <>
                                  <input type="number" className="input-field font-mono text-xs py-1 px-2 w-24"
                                    value={editFundAmount} onChange={(e) => setEditFundAmount(e.target.value)} />
                                  <input type="date" className="input-field text-xs py-1 px-2 flex-1"
                                    value={editFundDate} onChange={(e) => setEditFundDate(e.target.value)} />
                                  <button onClick={async () => {
                                    const ok = await updateProjectFundAmount(f, Number(editFundAmount), editFundDate);
                                    if (ok) { showToast("Montant modifié"); await fetchProjects(); }
                                  }} className="text-emerald-400 p-1"><Check size={14} /></button>
                                  <button onClick={() => setEditingFund(null)} className="text-slate-400 p-1"><X size={14} /></button>
                                </>
                              ) : (
                                <>
                                  <span className="font-mono text-xs font-semibold flex-1" style={{ color: p.color }}>{formatCFA(f.amount)}</span>
                                  <span className="text-[10px] text-slate-500">{new Date(f.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</span>
                                  <button onClick={() => { setEditingFund(f); setEditFundAmount(String(f.amount)); setEditFundDate(f.date); }} className="text-slate-500 hover:text-emerald-400 p-1" title="Modifier"><Pencil size={12} /></button>
                                  <button onClick={async () => { await removeProjectFund(f); showToast("Fond supprimé"); await fetchProjects(); }} className="text-slate-500 hover:text-red-400 p-1" title="Supprimer"><Trash2 size={12} /></button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {completedProjects.length > 0 && (
            <div className="mb-5 lg:mb-6">
              <h3 className="text-sm lg:text-base font-semibold text-emerald-400/90 mb-3 lg:mb-4 flex items-center gap-2">
                <ShoppingCart size={18} /> Suivi de réalisation — Projets terminés
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
                {completedProjects.map((p: Project) => {
                  const purchases = projectPurchases[p.id] || [];
                  const totalSpent = purchases.reduce((s, x) => s + x.amount, 0);
                  const totalFunds = p.saved_amount + totalSpent;
                  const remaining = p.saved_amount;
                  return (
                    <div key={p.id} className="glass-strong rounded-xl p-4 lg:p-5 border border-emerald-500/20">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          <Icon name={p.icon} size={18} style={{ color: p.color }} />
                          <span className="font-semibold">{p.name}</span>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEditModal(p)} className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400"><Pencil size={14} /></button>
                          <button onClick={() => removeProject(p.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="font-mono text-lg font-bold" style={{ color: p.color }}>{formatCFA(totalSpent)}</span>
                        <span className="text-slate-500 text-sm">/ {formatCFA(totalFunds)} dépensés</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-3">
                        <div className="h-full rounded-full transition-all" style={{ width: `${totalFunds > 0 ? Math.min(100, (totalSpent / totalFunds) * 100) : 0}%`, background: p.color }} />
                      </div>
                      <div className="space-y-2">
                        <button
                          onClick={() => { setExpandedPurchases((prev) => { const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; }); if (!expandedPurchases.has(p.id)) fetchProjectPurchases(p.id); }}
                          className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-300 py-2 px-3 rounded-lg bg-white/[0.03]">
                          <span className="flex items-center gap-2"><ShoppingCart size={14} /> Achats ({purchases.length})</span>
                          {expandedPurchases.has(p.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        {expandedPurchases.has(p.id) && (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {purchases.map((pu) => (
                              <div key={pu.id} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-white/[0.03] text-sm">
                                <span className="flex-1 truncate">{pu.description}</span>
                                <span className="font-mono font-semibold shrink-0" style={{ color: p.color }}>{formatCFA(pu.amount)}</span>
                                <span className="text-[10px] text-slate-500 shrink-0">{new Date(pu.date).toLocaleDateString("fr-FR")}</span>
                                <button onClick={() => handleRemovePurchase(pu)} className="text-slate-500 hover:text-red-400 p-1" title="Supprimer"><Trash2 size={12} /></button>
                              </div>
                            ))}
                            {addingPurchaseTo === p.id ? (
                              <div className="space-y-2 pt-2 border-t border-white/5">
                                <input className="input-field text-sm py-2 w-full" placeholder="Description de l'achat"
                                  value={purchaseForm.description} onChange={(e) => setPurchaseForm({ ...purchaseForm, description: e.target.value })} />
                                <div className="flex gap-2">
                                  <input type="number" className="input-field font-mono text-base py-3 min-w-[140px] flex-1" placeholder="Montant (FCFA)"
                                    value={purchaseForm.amount} onChange={(e) => setPurchaseForm({ ...purchaseForm, amount: e.target.value })} />
                                  <input type="date" className="input-field text-sm py-2 w-36"
                                    value={purchaseForm.date} onChange={(e) => setPurchaseForm({ ...purchaseForm, date: e.target.value })} />
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => handleAddPurchase(p)} className="btn-primary py-2 px-4 text-sm flex-1">Enregistrer l'achat</button>
                                  <button onClick={() => { setAddingPurchaseTo(null); setPurchaseForm({ description: "", amount: "", date: new Date().toISOString().split("T")[0] }); }} className="py-2 px-3 text-slate-400 text-sm">Annuler</button>
                                </div>
                                {remaining > 0 && <p className="text-xs text-slate-500">Reste disponible : {formatCFA(remaining)} FCFA</p>}
                              </div>
                            ) : remaining > 0 ? (
                              <button onClick={() => { setAddingPurchaseTo(p.id); setPurchaseForm({ description: "", amount: "", date: new Date().toISOString().split("T")[0] }); }}
                                className="w-full py-2.5 rounded-lg border border-dashed border-emerald-500/40 text-emerald-400/80 hover:bg-emerald-500/10 text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                                <Plus size={16} /> Ajouter un achat
                              </button>
                            ) : (
                              <p className="text-xs text-emerald-400/80 py-2 text-center">Budget épuisé</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {otherProjects.length > 0 && (
            <div>
              <h3 className="text-xs lg:text-sm font-semibold text-slate-400 mb-2 lg:mb-3">En pause</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-3">
                {otherProjects.map((p: Project) => {
                  const pct = p.target_amount > 0 ? (p.saved_amount / p.target_amount) * 100 : 0;
                  return (
                    <div key={p.id} className="glass rounded-xl p-3 lg:p-4 opacity-60">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs lg:text-sm truncate flex items-center gap-1.5">
                          <Icon name={p.icon} size={14} style={{ color: p.color }} />
                          {p.name}
                        </span>
                        <div className="flex gap-0.5 shrink-0">
                          <button onClick={() => openEditModal(p)} title="Modifier"
                            className="text-slate-500 hover:text-emerald-400 active:text-emerald-400 p-1 transition-colors"><Pencil size={12} /></button>
                          {p.status === "paused" && (
                            <button onClick={() => updateProject(p.id, { status: "active" })} title="Reprendre"
                              className="text-slate-500 hover:text-emerald-400 active:text-emerald-400 p-1 transition-colors"><Play size={12} /></button>
                          )}
                          <button onClick={() => removeProject(p.id)} title="Supprimer"
                            className="text-slate-500 hover:text-red-400 active:text-red-400 p-1 transition-colors"><Trash2 size={12} /></button>
                        </div>
                      </div>
                      <div className="font-mono text-xs lg:text-sm font-bold">{formatCFA(p.saved_amount)} / {formatCFA(p.target_amount)}</div>
                      <div className="mt-1.5">
                        <AnimatedProgressBar value={p.saved_amount} max={p.target_amount} gradient={`linear-gradient(90deg,${p.color},${p.color}cc)`} duration={0.6} />
                      </div>
                      <div className="text-[9px] lg:text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <><Pause size={10} className="text-amber-400" /> En pause</> — {pct.toFixed(0)}%
                      </div>
                      {(projectFunds[p.id]?.length ?? 0) > 0 && (
                        <button onClick={() => toggleFunds(p.id)} className="mt-1.5 w-full text-left text-[9px] text-slate-500 hover:text-slate-400 flex items-center gap-1">
                          <History size={10} /> {projectFunds[p.id]?.length} fonds
                          {expandedFunds.has(p.id) ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        </button>
                      )}
                      {expandedFunds.has(p.id) && (projectFunds[p.id]?.length ?? 0) > 0 && (
                        <div className="mt-1.5 space-y-1 max-h-24 overflow-y-auto">
                          {(projectFunds[p.id] || []).map((f) => (
                            <div key={f.id} className="flex items-center gap-2 py-1 px-2 rounded bg-white/[0.03] text-[9px]">
                              {editingFund?.id === f.id ? (
                                <>
                                  <input type="number" className="input-field font-mono py-0.5 px-1 w-16 text-[9px]"
                                    value={editFundAmount} onChange={(e) => setEditFundAmount(e.target.value)} />
                                  <input type="date" className="input-field py-0.5 px-1 flex-1 text-[9px]"
                                    value={editFundDate} onChange={(e) => setEditFundDate(e.target.value)} />
                                  <button onClick={async () => {
                                    const ok = await updateProjectFundAmount(f, Number(editFundAmount), editFundDate);
                                    if (ok) { showToast("Montant modifié"); await fetchProjects(); }
                                  }} className="text-emerald-400 p-0.5"><Check size={10} /></button>
                                  <button onClick={() => setEditingFund(null)} className="text-slate-400 p-0.5"><X size={10} /></button>
                                </>
                              ) : (
                                <>
                                  <span className="font-mono font-semibold flex-1" style={{ color: p.color }}>{formatCFA(f.amount)}</span>
                                  <span className="text-slate-600">{new Date(f.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>
                                  <button onClick={() => { setEditingFund(f); setEditFundAmount(String(f.amount)); setEditFundDate(f.date); }} className="text-slate-500 hover:text-emerald-400 p-0.5"><Pencil size={10} /></button>
                                  <button onClick={async () => { await removeProjectFund(f); showToast("Fond supprimé"); await fetchProjects(); }} className="text-slate-500 hover:text-red-400 p-0.5"><Trash2 size={10} /></button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Modal — Créer / Modifier un projet */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
          onClick={closeModal}>
          <div className="glass-strong w-full sm:w-[500px] rounded-t-2xl sm:rounded-2xl p-6 lg:p-8 animate-slide-up min-h-[85dvh] sm:min-h-0 max-h-[95dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base lg:text-lg font-bold flex items-center gap-2">
                {editingProject ? (
                  <><Pencil size={18} className="text-emerald-400" /> Modifier le projet</>
                ) : (
                  <><Target size={18} className="text-emerald-400" /> Nouveau Projet</>
                )}
              </h2>
              <button onClick={closeModal} className="text-slate-400 p-1"><X size={20} /></button>
            </div>
            <div className="grid gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Nom du projet</label>
                <input className="input-field" placeholder="Ex: Achat terrain..." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Description</label>
                <input className="input-field" placeholder="Détails..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Montant cible (FCFA)</label>
                  <input type="number" className="input-field font-mono" placeholder="0" value={form.target_amount}
                    onChange={(e) => setForm({ ...form, target_amount: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Échéance</label>
                  <input type="date" className="input-field" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-2 block">Icône</label>
                <div className="flex gap-2 flex-wrap">
                  {PROJECT_ICON_NAMES.map((iconName) => (
                    <button key={iconName} onClick={() => setForm({ ...form, icon: iconName })}
                      className={`w-9 h-9 lg:w-10 lg:h-10 rounded-lg flex items-center justify-center transition-all
                        ${form.icon === iconName ? "bg-emerald-500/30 ring-2 ring-emerald-500" : "bg-white/5"}`}>
                      <Icon name={iconName} size={18} className={form.icon === iconName ? "text-emerald-300" : "text-slate-400"} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-2 block">Couleur</label>
                <div className="flex gap-2">
                  {PROJECT_COLORS.map((color) => (
                    <button key={color} onClick={() => setForm({ ...form, color })}
                      className={`w-7 h-7 lg:w-8 lg:h-8 rounded-full transition-all ${form.color === color ? "ring-2 ring-white scale-110" : ""}`}
                      style={{ background: color }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={closeModal} className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm">Annuler</button>
              <button onClick={handleSave} className="btn-primary flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5">
                {editingProject ? <><Check size={16} /> Enregistrer</> : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Projet réalisé (sans dépense, suivi des achats au fur et à mesure) */}
      {realizingProject && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
          onClick={() => setRealizingProject(null)}>
          <div className="glass-strong w-full sm:w-[440px] rounded-t-2xl sm:rounded-2xl p-6 lg:p-8 animate-slide-up min-h-[85dvh] sm:min-h-0 max-h-[95dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Receipt size={18} className="text-emerald-400" /> Projet réalisé
              </h2>
              <button onClick={() => setRealizingProject(null)} className="text-slate-400 p-1"><X size={20} /></button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Marquer &quot;{realizingProject.name}&quot; comme réalisé. Tu pourras suivre les achats au fur et à mesure — chaque achat sera prélevé du solde épargné ({formatCFA(realizingProject.saved_amount)} FCFA), sans créer de dépense supplémentaire.
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setRealizingProject(null)} className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm">Annuler</button>
              <button onClick={handleRealizeProject} className="btn-primary flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5">
                <Receipt size={16} /> Marquer comme réalisé
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
