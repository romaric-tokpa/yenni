"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { formatCFA, AVAILABLE_ICONS, CATEGORY_COLORS, MONTHS_SHORT } from "@/lib/constants";
import { BudgetConfig, FixedCharge, FixedChargePayment, Category } from "@/lib/types";
import Icon from "./ui/Icon";
import { Coins, ClipboardList, FolderOpen, Plus, Trash2, X, Banknote, Check, Clock } from "lucide-react";

interface BudgetData {
  config: BudgetConfig;
  updateConfig: (c: BudgetConfig) => Promise<void>;
  salaries: number[];
  updateSalary: (month: number, amount: number) => Promise<void>;
  otherIncomes: number[];
  updateOtherIncome: (month: number, amount: number) => Promise<void>;
  fixedPayments: FixedChargePayment[];
  addFixedPayment: (p: Omit<FixedChargePayment, "id" | "created_at">) => Promise<boolean>;
  removeFixedPayment: (id: number) => Promise<void>;
  selectedMonth: number;
  selectedYear: number;
  totalFixed: number;
  resteAVivre: number;
  totalBudgetVar: number;
}

function SalarySection({
  salaries,
  selectedMonth,
  updateSalary,
}: {
  salaries: number[];
  selectedMonth: number;
  updateSalary: (month: number, amount: number) => Promise<void>;
}) {
  const totalAnnual = salaries.reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-lg border border-white/5 p-4 mb-4">
      <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
        <Banknote size={14} className="text-green-500" /> Salaire
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
        {MONTHS_SHORT.map((m, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 p-2 rounded-xl transition-all ${
              i === selectedMonth
                ? "bg-emerald-500/15 ring-1 ring-emerald-500/40"
                : salaries[i] > 0
                ? "bg-white/[0.03]"
                : "bg-white/[0.02]"
            }`}
          >
            <span className={`text-[10px] lg:text-xs font-medium w-8 ${i === selectedMonth ? "text-emerald-300" : "text-slate-500"}`}>
              {m}
            </span>
            <input
              type="number"
              className="input-field font-mono text-xs lg:text-[13px] py-1.5 px-2 flex-1 min-w-0"
              placeholder="0"
              defaultValue={salaries[i] || ""}
              key={`sal-s-${i}`}
              onChange={(e) => updateSalary(i, Number(e.target.value) || 0)}
            />
          </div>
        ))}
      </div>
      {totalAnnual > 0 && (
        <div className="flex justify-between mt-2 px-2.5 py-1.5 rounded-lg bg-white/4 text-xs">
          <span className="text-neutral-500">Total annuel</span>
          <span className="font-mono font-semibold text-green-500">{formatCFA(totalAnnual)}</span>
        </div>
      )}
    </div>
  );
}

function OtherIncomeSection({
  otherIncomes,
  selectedMonth,
  updateOtherIncome,
}: {
  otherIncomes: number[];
  selectedMonth: number;
  updateOtherIncome: (month: number, amount: number) => Promise<void>;
}) {
  const totalAnnual = otherIncomes.reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-lg border border-white/5 p-4 mb-4">
      <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
        <Coins size={14} className="text-amber-500" /> Autres revenus
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
        {MONTHS_SHORT.map((m, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 p-2 rounded-xl transition-all ${
              i === selectedMonth
                ? "bg-amber-500/15 ring-1 ring-amber-500/40"
                : otherIncomes[i] > 0
                ? "bg-white/[0.03]"
                : "bg-white/[0.02]"
            }`}
          >
            <span className={`text-[10px] lg:text-xs font-medium w-8 ${i === selectedMonth ? "text-amber-300" : "text-slate-500"}`}>
              {m}
            </span>
            <input
              type="number"
              className="input-field font-mono text-xs lg:text-[13px] py-1.5 px-2 flex-1 min-w-0"
              placeholder="0"
              defaultValue={otherIncomes[i] || ""}
              key={`oth-${i}`}
              onChange={(e) => updateOtherIncome(i, Number(e.target.value) || 0)}
            />
          </div>
        ))}
      </div>
      {totalAnnual > 0 && (
        <div className="flex justify-between mt-2 px-2.5 py-1.5 rounded-lg bg-white/4 text-xs">
          <span className="text-neutral-500">Total annuel</span>
          <span className="font-mono font-semibold text-amber-500">{formatCFA(totalAnnual)}</span>
        </div>
      )}
    </div>
  );
}

export default function Settings({
  budget,
  showToast,
}: {
  budget: BudgetData;
  showToast: (m: string, t?: string) => void;
}) {
  const { config, updateConfig, salaries, updateSalary, otherIncomes, updateOtherIncome, fixedPayments, addFixedPayment, removeFixedPayment, selectedMonth, selectedYear, totalFixed, resteAVivre, totalBudgetVar } = budget;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [showAddCharge, setShowAddCharge] = useState(false);
  const [newCharge, setNewCharge] = useState({ label: "", amount: "", icon: "house" });
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({ label: "", budget: "", icon: "wrench", color: "#10B981" });
  const [showPayCharge, setShowPayCharge] = useState<FixedCharge | null>(null);
  const now = new Date();
  const [payForm, setPayForm] = useState({
    amount: "",
    date: now.toISOString().split("T")[0],
    time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    notes: "",
  });

  const save = useCallback(
    (newConfig: BudgetConfig) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        updateConfig(newConfig);
        showToast("Paramètres sauvegardés", "info");
      }, 800);
    },
    [updateConfig, showToast]
  );

  const saveImmediate = useCallback(
    (newConfig: BudgetConfig) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      updateConfig(newConfig);
      showToast("Paramètres sauvegardés", "info");
    },
    [updateConfig, showToast]
  );

  const updateField = (field: string, value: number) => {
    save({ ...config, [field]: value });
  };

  const updateCharge = (idx: number, amount: number) => {
    save({
      ...config,
      fixedCharges: config.fixedCharges.map((c: FixedCharge, i: number) =>
        i === idx ? { ...c, amount } : c
      ),
    });
  };

  const removeCharge = (idx: number) => {
    const updated = config.fixedCharges.filter((_: FixedCharge, i: number) => i !== idx);
    saveImmediate({ ...config, fixedCharges: updated });
  };

  const addCharge = () => {
    if (!newCharge.label) { showToast("Nom requis", "error"); return; }
    const id = newCharge.label.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now();
    const charge: FixedCharge = {
      id,
      label: newCharge.label,
      amount: Number(newCharge.amount) || 0,
      icon: newCharge.icon,
    };
    saveImmediate({ ...config, fixedCharges: [...config.fixedCharges, charge] });
    setNewCharge({ label: "", amount: "", icon: "house" });
    setShowAddCharge(false);
    showToast("Charge ajoutée !");
  };

  const updateCatBudget = (idx: number, budgetVal: number) => {
    save({
      ...config,
      categories: config.categories.map((c: Category, i: number) =>
        i === idx ? { ...c, budget: budgetVal } : c
      ),
    });
  };

  const removeCategory = (idx: number) => {
    const updated = config.categories.filter((_: Category, i: number) => i !== idx);
    saveImmediate({ ...config, categories: updated });
  };

  const addCategory = () => {
    if (!newCategory.label) { showToast("Nom requis", "error"); return; }
    const id = newCategory.label.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now();
    const cat: Category = {
      id,
      label: newCategory.label,
      budget: Number(newCategory.budget) || 0,
      icon: newCategory.icon,
      color: newCategory.color,
    };
    saveImmediate({ ...config, categories: [...config.categories, cat] });
    setNewCategory({ label: "", budget: "", icon: "wrench", color: "#10B981" });
    setShowAddCategory(false);
    showToast("Catégorie ajoutée !");
  };

  return (
    <div className="animate-slide-up">
      <h1 className="text-lg font-semibold mb-4">Paramètres</h1>

      <SalarySection
        salaries={salaries}
        selectedMonth={selectedMonth}
        updateSalary={updateSalary}
      />

      {/* Autres revenus par mois */}
      <OtherIncomeSection
        otherIncomes={otherIncomes}
        selectedMonth={selectedMonth}
        updateOtherIncome={updateOtherIncome}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg border border-white/5 p-4">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Coins size={14} className="text-green-500" /> Fonds d&apos;urgence
          </h3>
          <div className="grid gap-2">
            <div>
              <label className="text-[10px] text-neutral-500 mb-0.5 block">Objectif (FCFA)</label>
              <input type="number" className="input-field font-mono" placeholder="Ex: 2 000 000"
                defaultValue={config.savingsGoal || ""} onChange={(e) => updateField("savingsGoal", Number(e.target.value))} />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 mb-0.5 block">Début période</label>
              <input type="date" className="input-field"
                defaultValue={config.savingsGoalStartDate || ""}
                onChange={(e) => save({ ...config, savingsGoalStartDate: e.target.value || undefined })} />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 mb-0.5 block">Date cible</label>
              <input type="date" className="input-field"
                defaultValue={config.savingsGoalDeadline || ""}
                onChange={(e) => save({ ...config, savingsGoalDeadline: e.target.value || undefined })} />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-white/5 p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <ClipboardList size={14} className="text-red-500" /> Charges fixes
            </h3>
            <button onClick={() => setShowAddCharge(true)}
              className="text-emerald-400 text-[10px] lg:text-xs font-medium flex items-center gap-1 hover:text-emerald-300 transition-colors">
              <Plus size={14} /> Ajouter un type
            </button>
          </div>

          {config.fixedCharges.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              Aucune charge fixe définie. Ajoute ton loyer, tes abonnements, etc.
            </div>
          ) : (
            <>
            <p className="text-[10px] text-slate-500 mb-2">
              Créées automatiquement au 1er de chaque mois.
            </p>
            <div className="grid gap-2 lg:gap-2.5">
              {config.fixedCharges.map((ch: FixedCharge, idx: number) => {
                const paid = fixedPayments.filter((p) => p.charge_id === ch.id);
                const paidTotal = paid.reduce((s, p) => s + p.amount, 0);
                return (
                  <div key={ch.id} className="bg-white/[0.02] rounded-xl p-2.5 lg:p-3">
                    <div className="flex items-center gap-2 lg:gap-3 group">
                      <span className="w-6 lg:w-7 flex justify-center">
                        <Icon name={ch.icon} size={16} className="text-slate-400" />
                      </span>
                      <span className="flex-1 text-[10px] lg:text-xs text-slate-300 font-medium truncate">{ch.label}</span>
                      {paidTotal > 0 && (
                        <span className="text-[9px] lg:text-[10px] font-mono text-red-400">
                          {formatCFA(paidTotal)}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          const n = new Date();
                          setPayForm({
                            amount: String(ch.amount || ""),
                            date: n.toISOString().split("T")[0],
                            time: `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`,
                            notes: "",
                          });
                          setShowPayCharge(ch);
                        }}
                        className="text-emerald-400 text-[10px] lg:text-xs font-medium flex items-center gap-1 hover:text-emerald-300 transition-colors"
                      >
                        <Plus size={12} /> Payer
                      </button>
                      <button onClick={() => removeCharge(idx)}
                        className="text-slate-600 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100 lg:opacity-100">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {paid.length > 0 && (
                      <div className="mt-2 ml-8 grid gap-1">
                        {paid.map((p) => (
                          <div key={p.id} className="flex items-center gap-2 text-[9px] lg:text-[10px] text-slate-500 group/item">
                            <Clock size={10} className="text-slate-600" />
                            <span>{p.date} à {p.time}</span>
                            <span className="font-mono text-red-400/80">{formatCFA(p.amount)}</span>
                            {p.notes && <span className="text-slate-600 truncate">— {p.notes}</span>}
                            <button onClick={() => removeFixedPayment(p.id)}
                              className="ml-auto text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover/item:opacity-100">
                              <Trash2 size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </>
          )}

          {totalFixed > 0 && (
            <div className="flex justify-between mt-3 lg:mt-4 px-3 py-2 lg:py-2.5 rounded-xl bg-red-500/10">
              <span className="text-xs lg:text-[13px] font-semibold">Total payé ce mois</span>
              <span className="font-mono font-bold text-red-400 text-xs lg:text-sm">{formatCFA(totalFixed)} FCFA</span>
            </div>
          )}
        </div>
      </div>

      {/* Catégories de dépenses */}
      <div className="glass-strong rounded-2xl p-4 lg:p-6">
        <div className="flex justify-between items-center mb-3 lg:mb-4">
          <h3 className="text-xs lg:text-sm font-semibold flex items-center gap-2">
            <FolderOpen size={16} className="text-emerald-400" /> Budgets par Catégorie
          </h3>
          <button onClick={() => setShowAddCategory(true)}
            className="text-emerald-400 text-[10px] lg:text-xs font-medium flex items-center gap-1 hover:text-emerald-300 transition-colors">
            <Plus size={14} /> Ajouter
          </button>
        </div>

        {config.categories.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            Aucune catégorie. Ajoute tes postes de dépenses.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-3">
            {config.categories.map((cat: Category, idx: number) => (
              <div key={cat.id}
                className="flex items-center gap-2 lg:gap-3 p-2.5 lg:p-3 bg-white/[0.02] rounded-xl group"
                style={{ borderLeft: `3px solid ${cat.color}` }}>
                <span className="flex justify-center w-5">
                  <Icon name={cat.icon} size={14} style={{ color: cat.color }} />
                </span>
                <span className="flex-1 text-[10px] lg:text-xs text-slate-400 truncate">{cat.label}</span>
                <input type="number" className="input-field w-20 lg:w-24 font-mono text-xs lg:text-[13px] py-1.5 px-2"
                  placeholder="0" defaultValue={cat.budget || ""} onChange={(e) => updateCatBudget(idx, Number(e.target.value))} />
                <button onClick={() => removeCategory(idx)}
                  className="text-slate-600 hover:text-red-400 active:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100 lg:opacity-100">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {config.categories.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3 mt-4 lg:mt-5">
            <div className="flex justify-between px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl bg-amber-500/10">
              <span className="text-[11px] lg:text-[13px] font-semibold">Total Variable</span>
              <span className="font-mono font-bold text-amber-400 text-xs lg:text-sm">{formatCFA(totalBudgetVar)} FCFA</span>
            </div>
            <div className="flex justify-between px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl"
              style={{ background: resteAVivre - totalBudgetVar >= 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)" }}>
              <span className="text-[11px] lg:text-[13px] font-semibold">Écart dispo</span>
              <span className={`font-mono font-bold text-xs lg:text-sm ${resteAVivre - totalBudgetVar >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatCFA(resteAVivre - totalBudgetVar)} FCFA
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Modal — Ajouter une charge fixe */}
      {showAddCharge && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
          onClick={() => setShowAddCharge(false)}>
          <div className="popup-panel w-full sm:w-[440px] rounded-t-2xl sm:rounded-2xl p-6 lg:p-8 animate-slide-up min-h-[85dvh] sm:min-h-0 max-h-[95dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Plus size={18} className="text-red-400" /> Nouvelle Charge Fixe
              </h2>
              <button onClick={() => setShowAddCharge(false)} className="text-slate-400 p-1"><X size={20} /></button>
            </div>
            <div className="grid gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Nom</label>
                <input className="input-field" placeholder="Ex: Loyer, Internet, Assurance..."
                  value={newCharge.label} onChange={(e) => setNewCharge({ ...newCharge, label: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Montant mensuel (FCFA)</label>
                <input type="number" className="input-field font-mono" placeholder="0"
                  value={newCharge.amount} onChange={(e) => setNewCharge({ ...newCharge, amount: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-2 block">Icône</label>
                <div className="flex gap-1.5 flex-wrap">
                  {AVAILABLE_ICONS.slice(0, 18).map((iconName) => (
                    <button key={iconName} onClick={() => setNewCharge({ ...newCharge, icon: iconName })}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all
                        ${newCharge.icon === iconName ? "bg-emerald-500/30 ring-2 ring-emerald-500" : "bg-white/5"}`}>
                      <Icon name={iconName} size={16} className={newCharge.icon === iconName ? "text-emerald-300" : "text-slate-400"} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddCharge(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm">Annuler</button>
              <button onClick={addCharge} className="btn-primary flex-1 py-3 rounded-xl text-sm font-semibold">Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Ajouter une catégorie */}
      {showAddCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
          onClick={() => setShowAddCategory(false)}>
          <div className="popup-panel w-full sm:w-[440px] rounded-t-2xl sm:rounded-2xl p-6 lg:p-8 animate-slide-up min-h-[85dvh] sm:min-h-0 max-h-[95dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Plus size={18} className="text-emerald-400" /> Nouvelle Catégorie
              </h2>
              <button onClick={() => setShowAddCategory(false)} className="text-slate-400 p-1"><X size={20} /></button>
            </div>
            <div className="grid gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Nom</label>
                <input className="input-field" placeholder="Ex: Alimentation, Transport..."
                  value={newCategory.label} onChange={(e) => setNewCategory({ ...newCategory, label: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Budget mensuel (FCFA)</label>
                <input type="number" className="input-field font-mono" placeholder="0"
                  value={newCategory.budget} onChange={(e) => setNewCategory({ ...newCategory, budget: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-2 block">Icône</label>
                <div className="flex gap-1.5 flex-wrap">
                  {AVAILABLE_ICONS.slice(0, 18).map((iconName) => (
                    <button key={iconName} onClick={() => setNewCategory({ ...newCategory, icon: iconName })}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all
                        ${newCategory.icon === iconName ? "bg-emerald-500/30 ring-2 ring-emerald-500" : "bg-white/5"}`}>
                      <Icon name={iconName} size={16} className={newCategory.icon === iconName ? "text-emerald-300" : "text-slate-400"} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-2 block">Couleur</label>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORY_COLORS.map((color) => (
                    <button key={color} onClick={() => setNewCategory({ ...newCategory, color })}
                      className={`w-7 h-7 rounded-full transition-all ${newCategory.color === color ? "ring-2 ring-white scale-110" : ""}`}
                      style={{ background: color }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddCategory(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm">Annuler</button>
              <button onClick={addCategory} className="btn-primary flex-1 py-3 rounded-xl text-sm font-semibold">Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Payer une charge fixe */}
      {showPayCharge && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
          onClick={() => setShowPayCharge(null)}>
          <div className="popup-panel w-full sm:w-[440px] rounded-t-2xl sm:rounded-2xl p-6 lg:p-8 animate-slide-up min-h-[85dvh] sm:min-h-0 max-h-[95dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Icon name={showPayCharge.icon} size={18} className="text-red-400" />
                Payer — {showPayCharge.label}
              </h2>
              <button onClick={() => setShowPayCharge(null)} className="text-slate-400 p-1"><X size={20} /></button>
            </div>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Date</label>
                  <input type="date" className="input-field font-mono"
                    value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Heure</label>
                  <input type="time" className="input-field font-mono"
                    value={payForm.time} onChange={(e) => setPayForm({ ...payForm, time: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Montant (FCFA)</label>
                <input type="number" className="input-field font-mono" placeholder="0"
                  value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Notes (optionnel)</label>
                <input className="input-field" placeholder="Ex: Paiement mars, retard..."
                  value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowPayCharge(null)} className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm">Annuler</button>
              <button
                onClick={async () => {
                  const amt = Number(payForm.amount);
                  if (!amt || amt <= 0) { showToast("Montant requis", "error"); return; }
                  const payDate = new Date(payForm.date);
                  const ok = await addFixedPayment({
                    charge_id: showPayCharge.id,
                    label: showPayCharge.label,
                    icon: showPayCharge.icon,
                    amount: amt,
                    date: payForm.date,
                    time: payForm.time,
                    month: payDate.getMonth(),
                    year: payDate.getFullYear(),
                    notes: payForm.notes,
                  });
                  if (ok) {
                    showToast(`${showPayCharge.label} payé — ${formatCFA(amt)} FCFA`);
                    setShowPayCharge(null);
                  }
                }}
                className="flex-1 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Check size={16} /> Enregistrer le paiement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
