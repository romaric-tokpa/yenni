"use client";

import { useState } from "react";
import { Heart, X, Check } from "lucide-react";
import type { BudgetContextValue } from "./types";

interface ModalNewWishListProps {
  onClose: () => void;
  budget: BudgetContextValue;
}

export default function ModalNewWishList({ onClose, budget }: ModalNewWishListProps) {
  const { showToast } = budget;
  const now = new Date();
  const [form, setForm] = useState({
    name: "",
    scheduled_date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15`,
  });

  const handleSubmit = async () => {
    if (!form.name || !form.scheduled_date) {
      showToast("Nom et date requis", "error");
      return;
    }
    try {
      const r = await fetch("/api/wish-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (r.ok) {
        showToast("Liste créée !");
        onClose();
      } else {
        const data = await r.json().catch(() => ({}));
        showToast(data.error || "Erreur", "error");
      }
    } catch {
      showToast("Erreur réseau", "error");
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-base lg:text-lg font-bold flex items-center gap-2">
          <Heart size={18} className="text-pink-400" /> Nouvelle liste d&apos;envies
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1"><X size={20} /></button>
      </div>
      <div className="grid gap-4">
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Nom de la liste *</label>
          <input className="input-field" placeholder="Ex: Envies vêtements, Électronique" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Date prévue *</label>
          <input type="date" className="input-field" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
        </div>
      </div>
      <div className="flex gap-3 mt-6 pt-4 border-t border-white/5">
        <button onClick={onClose} className="flex-1 min-h-[44px] py-3 rounded-lg border border-white/10 text-neutral-400 hover:text-white text-sm font-medium transition-colors">Annuler</button>
        <button onClick={handleSubmit} className="btn-primary flex-1 min-h-[44px] py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5">
          <Check size={16} /> Créer
        </button>
      </div>
    </>
  );
}
