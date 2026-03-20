"use client";

import { useState } from "react";
import { CalendarClock, X, Check } from "lucide-react";
import type { Category } from "@/lib/types";
import type { BudgetContextValue } from "./types";

interface ModalPlanExpenseProps {
  onClose: () => void;
  budget: BudgetContextValue;
}

export default function ModalPlanExpense({ onClose, budget }: ModalPlanExpenseProps) {
  const { config, addPlannedExpense, showToast } = budget;
  const [form, setForm] = useState({
    due_date: new Date().toISOString().split("T")[0],
    description: "",
    category: config.categories[0]?.id || "food",
    amount: "",
    notes: "",
  });

  const handleSubmit = async () => {
    if (!form.due_date || !form.description || !form.amount || Number(form.amount) <= 0) {
      showToast("Remplis tous les champs", "error");
      return;
    }
    await addPlannedExpense({
      due_date: form.due_date,
      description: form.description,
      category: form.category,
      amount: Number(form.amount),
      notes: form.notes,
      status: "pending",
    });
    showToast("Dépense planifiée !");
    onClose();
  };

  return (
    <>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-base lg:text-lg font-bold flex items-center gap-2">
          <CalendarClock size={18} className="text-emerald-400" /> Planifier une dépense
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1"><X size={20} /></button>
      </div>
      <div className="grid gap-4">
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Date d&apos;échéance</label>
          <input type="date" className="input-field" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Description</label>
          <input className="input-field" placeholder="Ex: Renouveler abonnement..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Catégorie</label>
            <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {config.categories.map((c: Category) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Montant (FCFA)</label>
            <input type="number" className="input-field font-mono" placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Notes (optionnel)</label>
          <input className="input-field" placeholder="Détails..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>
      <div className="flex gap-3 mt-6 pt-4 border-t border-white/5">
        <button onClick={onClose} className="flex-1 min-h-[44px] py-3 rounded-lg border border-white/10 text-neutral-400 hover:text-white text-sm font-medium transition-colors">Annuler</button>
        <button onClick={handleSubmit} className="btn-primary flex-1 min-h-[44px] py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5">
          <Check size={16} /> Planifier
        </button>
      </div>
    </>
  );
}
