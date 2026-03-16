"use client";
import { useState } from "react";
import { formatCFA } from "@/lib/constants";
import { Plus, X, Trash2, Pause, Play, CheckCircle, Target, Pencil, Check } from "lucide-react";
import { Project } from "@/lib/types";
import Icon from "./ui/Icon";
import { PROJECT_ICON_NAMES } from "./ui/Icon";

const PROJECT_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#f97316",
];

interface BudgetData {
  projects: Project[];
  addProject: (p: Omit<Project, "id" | "created_at">) => Promise<boolean>;
  updateProject: (id: number, updates: Partial<Project>) => Promise<void>;
  removeProject: (id: number) => Promise<void>;
}

export default function ProjectsView({
  budget,
  showToast,
}: {
  budget: BudgetData;
  showToast: (m: string, t?: string) => void;
}) {
  const { projects, addProject, updateProject, removeProject } = budget;
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const formDefault = {
    name: "", description: "", target_amount: "", deadline: "",
    icon: "target", color: "#6366f1", status: "active" as Project["status"], saved_amount: 0,
  };
  const [form, setForm] = useState(formDefault);
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [addAmount, setAddAmount] = useState("");

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
    await updateProject(p.id, { saved_amount: p.saved_amount + amt });
    showToast(`${formatCFA(amt)} FCFA ajoutés à ${p.name}`);
    setAddingTo(null); setAddAmount("");
  };

  const activeProjects = projects.filter((p: Project) => p.status === "active");
  const otherProjects = projects.filter((p: Project) => p.status !== "active");
  const totalProjectSaved = projects.reduce((s: number, p: Project) => s + p.saved_amount, 0);
  const totalProjectTarget = projects.reduce((s: number, p: Project) => s + p.target_amount, 0);

  return (
    <div className="animate-slide-up">
      <div className="flex justify-between items-start mb-5 lg:mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold">Mes Projets</h1>
          <p className="text-slate-500 text-xs lg:text-sm mt-0.5">
            {activeProjects.length} actifs — {formatCFA(totalProjectSaved)} / {formatCFA(totalProjectTarget)} FCFA
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
            <Target size={48} className="text-indigo-400" />
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
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 mb-5 lg:mb-6">
            {activeProjects.map((p: Project) => {
              const pct = p.target_amount > 0 ? (p.saved_amount / p.target_amount) * 100 : 0;
              const remaining = p.target_amount - p.saved_amount;
              return (
                <div key={p.id} className="glass-strong kpi-card rounded-2xl p-4 lg:p-6" style={{ borderLeft: `4px solid ${p.color}` }}>
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
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 active:text-indigo-400 transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => updateProject(p.id, { status: "paused" })} title="Mettre en pause"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 active:text-amber-400 transition-colors"><Pause size={14} /></button>
                      <button onClick={() => { updateProject(p.id, { status: "completed" }); showToast("Projet terminé !"); }} title="Terminer"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 active:text-emerald-400 transition-colors"><CheckCircle size={14} /></button>
                      <button onClick={() => removeProject(p.id)} title="Supprimer"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 active:text-red-400 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="flex justify-between items-end mb-2">
                    <div className="font-mono text-xl lg:text-2xl font-bold" style={{ color: p.color }}>{formatCFA(p.saved_amount)}</div>
                    <div className="text-[10px] lg:text-xs text-slate-400">/ {formatCFA(p.target_amount)}</div>
                  </div>
                  <div className="h-1.5 lg:h-2 bg-white/5 rounded-full overflow-hidden mb-2 lg:mb-3">
                    <div className="progress-bar h-full rounded-full"
                      style={{ width: `${Math.min(pct, 100)}%`, background: `linear-gradient(90deg,${p.color},${p.color}cc)` }} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-[10px] lg:text-[11px] text-slate-500 mb-3 lg:mb-4">
                    <span>{pct.toFixed(1)}%</span>
                    <span>Reste: {formatCFA(Math.max(remaining, 0))}</span>
                    {p.deadline && <span>{new Date(p.deadline).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}</span>}
                  </div>
                  {addingTo === p.id ? (
                    <div className="flex gap-2">
                      <input type="number" className="input-field font-mono text-sm py-2 flex-1" placeholder="Montant"
                        value={addAmount} onChange={(e) => setAddAmount(e.target.value)} autoFocus />
                      <button onClick={() => handleAddFunds(p)} className="btn-primary px-4 py-2 rounded-lg text-xs font-semibold">OK</button>
                      <button onClick={() => { setAddingTo(null); setAddAmount(""); }}
                        className="px-3 py-2 rounded-lg border border-white/10 text-xs text-slate-400">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingTo(p.id)}
                      className="w-full py-2.5 rounded-xl text-xs font-semibold border border-dashed transition-colors flex items-center justify-center gap-1.5"
                      style={{ borderColor: p.color + "66", color: p.color }}>
                      <Plus size={14} /> Ajouter des fonds
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {otherProjects.length > 0 && (
            <div>
              <h3 className="text-xs lg:text-sm font-semibold text-slate-400 mb-2 lg:mb-3">En pause / terminés</h3>
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
                            className="text-slate-500 hover:text-indigo-400 active:text-indigo-400 p-1 transition-colors"><Pencil size={12} /></button>
                          {p.status === "paused" && (
                            <button onClick={() => updateProject(p.id, { status: "active" })} title="Reprendre"
                              className="text-slate-500 hover:text-emerald-400 active:text-emerald-400 p-1 transition-colors"><Play size={12} /></button>
                          )}
                          <button onClick={() => removeProject(p.id)} title="Supprimer"
                            className="text-slate-500 hover:text-red-400 active:text-red-400 p-1 transition-colors"><Trash2 size={12} /></button>
                        </div>
                      </div>
                      <div className="font-mono text-xs lg:text-sm font-bold">{formatCFA(p.saved_amount)} / {formatCFA(p.target_amount)}</div>
                      <div className="text-[9px] lg:text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                        {p.status === "completed" ? (
                          <><CheckCircle size={10} className="text-emerald-400" /> Terminé</>
                        ) : (
                          <><Pause size={10} className="text-amber-400" /> En pause</>
                        )} — {pct.toFixed(0)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal — Créer / Modifier un projet */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
          onClick={closeModal}>
          <div className="glass-strong w-full sm:w-[500px] rounded-t-2xl sm:rounded-2xl p-6 lg:p-8 animate-slide-up max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base lg:text-lg font-bold flex items-center gap-2">
                {editingProject ? (
                  <><Pencil size={18} className="text-indigo-400" /> Modifier le projet</>
                ) : (
                  <><Target size={18} className="text-indigo-400" /> Nouveau Projet</>
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
                        ${form.icon === iconName ? "bg-indigo-500/30 ring-2 ring-indigo-500" : "bg-white/5"}`}>
                      <Icon name={iconName} size={18} className={form.icon === iconName ? "text-indigo-300" : "text-slate-400"} />
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
    </div>
  );
}
