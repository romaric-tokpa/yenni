"use client";

import { useState } from "react";
import { Plus, X, Check } from "lucide-react";
import type { BudgetContextValue } from "./types";

interface ModalNewShoppingItemProps {
  onClose: () => void;
  budget: BudgetContextValue;
  listId: string;
  listName: string;
}

export default function ModalNewShoppingItem({ onClose, budget, listId, listName }: ModalNewShoppingItemProps) {
  const { config, showToast } = budget;
  const categories = config.categories ?? [];
  const defaultCategory = categories[0]?.id || "food";
  const [form, setForm] = useState({
    name: "",
    estimated_amount: "",
    category: defaultCategory,
  });

  const handleSubmit = async () => {
    if (!listId || !form.name || form.estimated_amount === "" || Number(form.estimated_amount) < 0) {
      showToast("Nom et budget requis", "error");
      return;
    }
    try {
      const r = await fetch(`/api/shopping-lists/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          estimated_amount: Number(form.estimated_amount),
          category: form.category,
        }),
      });
      if (r.ok) {
        showToast("Article ajouté !");
        onClose();
      } else {
        showToast("Erreur", "error");
      }
    } catch {
      showToast("Erreur réseau", "error");
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-base lg:text-lg font-bold flex items-center gap-2">
          <Plus size={18} className="text-amber-400" /> Nouvel article — {listName || "Liste"}
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1"><X size={20} /></button>
      </div>
      <section className="space-y-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Informations</h3>
        <div className="grid gap-4">
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Description *</label>
            <input className="input-field" placeholder="Ex: Riz, Lait, Pain..." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Catégorie *</label>
              <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {categories.length === 0 ? <option value="food">Alimentation</option> : categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Montant (FCFA) *</label>
              <input type="number" className="input-field font-mono" placeholder="0" value={form.estimated_amount} onChange={(e) => setForm({ ...form, estimated_amount: e.target.value })} />
            </div>
          </div>
        </div>
      </section>
      <div className="flex gap-3 mt-6 pt-4 border-t border-white/5">
        <button onClick={onClose} className="flex-1 min-h-[44px] py-3 rounded-lg border border-white/10 text-neutral-400 hover:text-white text-sm font-medium transition-colors">Annuler</button>
        <button onClick={handleSubmit} className="btn-primary flex-1 min-h-[44px] py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5">
          <Check size={16} /> Enregistrer
        </button>
      </div>
    </>
  );
}
