"use client";

import { useState } from "react";
import { TrendingUp, X, Check } from "lucide-react";
import type { BudgetContextValue } from "./types";

const INCOME_SOURCES = [
  { id: "salary", label: "Salaire" },
  { id: "freelance", label: "Freelance" },
  { id: "gift", label: "Don / Cadeau" },
  { id: "refund", label: "Remboursement" },
  { id: "investment", label: "Investissement" },
  { id: "project", label: "Épargne projet" },
  { id: "loan_recovery", label: "Remboursement prêt reçu" },
  { id: "other", label: "Autre" },
];

interface ModalNewIncomeProps {
  onClose: () => void;
  budget: BudgetContextValue;
}

export default function ModalNewIncome({ onClose, budget }: ModalNewIncomeProps) {
  const { addIncome, showToast, fetchAccounts, accountsWithBalance } = budget;
  const activeAccounts = accountsWithBalance.filter((a) => !a.is_archived);
  const defaultAccountId = activeAccounts[0]?.id;
  const now = new Date();
  const [form, setForm] = useState({
    date: now.toISOString().split("T")[0],
    time: now.toTimeString().slice(0, 5),
    description: "",
    source: "other",
    amount: "",
    notes: "",
    account_id: "" as string,
  });

  const handleSubmit = async () => {
    if (!form.description || !form.amount || Number(form.amount) <= 0) {
      showToast("Remplis description et montant", "error");
      return;
    }
    if (activeAccounts.length === 0) {
      showToast("Crée d’abord un compte dans Réglages → Trésorerie", "error");
      return;
    }
    const acc = form.account_id ? Number(form.account_id) : defaultAccountId;
    const ok = await addIncome({
      ...form,
      amount: Number(form.amount),
      time: form.time || "00:00",
      account_id: acc,
    });
    if (!ok) return;
    showToast("Revenu enregistré !");
    await fetchAccounts?.();
    onClose();
  };

  return (
    <>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-base lg:text-lg font-bold flex items-center gap-2">
          <TrendingUp size={18} className="text-emerald-400" /> Nouveau revenu
        </h2>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1">
          <X size={20} />
        </button>
      </div>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Date</label>
            <input
              type="date"
              className="input-field"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Heure</label>
            <input
              type="time"
              className="input-field"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Description</label>
          <input
            className="input-field"
            placeholder="Ex: Prime, vente…"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Compte crédité</label>
          <select
            className="input-field"
            value={form.account_id || (defaultAccountId ? String(defaultAccountId) : "")}
            onChange={(e) => setForm({ ...form, account_id: e.target.value })}
          >
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Source</label>
            <select
              className="input-field"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
            >
              {INCOME_SOURCES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Montant (FCFA)</label>
            <input
              type="number"
              className="input-field font-mono"
              placeholder="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Notes (optionnel)</label>
          <input
            className="input-field"
            placeholder="Notes…"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 rounded-lg border border-white/10 text-neutral-400 hover:text-white text-sm font-medium transition-colors"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="btn-primary flex-1 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5"
        >
          <Check size={16} /> Enregistrer
        </button>
      </div>
    </>
  );
}
