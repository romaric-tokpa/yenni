"use client";

import { useState, useEffect } from "react";
import { ArrowRightLeft, X, Check } from "lucide-react";
import { accountHasActiveOutgoingLock } from "@/lib/constants";
import type { BudgetContextValue } from "./types";

interface ModalQuickTransferProps {
  onClose: () => void;
  budget: BudgetContextValue;
}

export default function ModalQuickTransfer({ onClose, budget }: ModalQuickTransferProps) {
  const { showToast, fetchAccounts, accountsWithBalance } = budget;
  const activeAccounts = accountsWithBalance.filter((a) => !a.is_archived);
  const fromAccounts = activeAccounts.filter((a) => !accountHasActiveOutgoingLock(a.kind, a.vault_unlocks_on));

  const [form, setForm] = useState({
    from_account_id: "",
    to_account_id: "",
    amount: "",
    fee: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  useEffect(() => {
    if (fromAccounts.length >= 2 && !form.from_account_id) {
      setForm((f) => ({
        ...f,
        from_account_id: String(fromAccounts[0].id),
        to_account_id: String(fromAccounts[1].id),
      }));
    } else if (fromAccounts.length === 1 && activeAccounts.length >= 2) {
      const other = activeAccounts.find((a) => a.id !== fromAccounts[0].id);
      if (other && !form.from_account_id) {
        setForm((f) => ({
          ...f,
          from_account_id: String(fromAccounts[0].id),
          to_account_id: String(other.id),
        }));
      }
    }
  }, [fromAccounts, activeAccounts, form.from_account_id]);

  const handleSubmit = async () => {
    const from = parseInt(form.from_account_id, 10);
    const to = parseInt(form.to_account_id, 10);
    const amount = Math.round(Number(form.amount));
    if (!from || !to || amount <= 0) {
      showToast("Choisis deux comptes et un montant valide", "error");
      return;
    }
    if (from === to) {
      showToast("Les comptes doivent être différents", "error");
      return;
    }
    const r = await fetch("/api/account-transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_account_id: from,
        to_account_id: to,
        amount,
        fee: form.fee ? Math.round(Number(form.fee)) : 0,
        date: form.date,
        notes: form.notes,
      }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      showToast((e as { error?: string }).error || "Erreur transfert", "error");
      return;
    }
    showToast("Transfert enregistré !");
    await fetchAccounts?.();
    onClose();
  };

  if (activeAccounts.length < 2) {
    return (
      <>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-cyan-400" /> Transfert
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 p-1">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-neutral-400">
          Il faut au moins deux comptes pour un transfert. Ajoute-en un dans{" "}
          <span className="text-white">Réglages → Trésorerie</span>.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full py-3 rounded-lg border border-white/10 text-sm text-neutral-300"
        >
          Fermer
        </button>
      </>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-base lg:text-lg font-bold flex items-center gap-2">
          <ArrowRightLeft size={18} className="text-cyan-400" /> Transfert entre comptes
        </h2>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1">
          <X size={20} />
        </button>
      </div>
      <p className="text-[11px] text-neutral-500 mb-4">
        Déplace de l’argent d’un compte à un autre (sans passer par une dépense ou un revenu).
      </p>
      <div className="grid gap-4">
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Depuis</label>
          <select
            className="input-field"
            value={form.from_account_id}
            onChange={(e) => setForm({ ...form, from_account_id: e.target.value })}
          >
            {fromAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-neutral-600 mt-1">Les coffres verrouillés ne peuvent pas être sources.</p>
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Vers</label>
          <select
            className="input-field"
            value={form.to_account_id}
            onChange={(e) => setForm({ ...form, to_account_id: e.target.value })}
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
            <label className="text-xs text-neutral-500 mb-1.5 block">Montant (FCFA)</label>
            <input
              type="number"
              className="input-field font-mono"
              placeholder="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Date</label>
            <input
              type="date"
              className="input-field"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Frais (optionnel)</label>
          <input
            type="number"
            className="input-field font-mono"
            placeholder="0"
            value={form.fee}
            onChange={(e) => setForm({ ...form, fee: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Note (optionnel)</label>
          <input
            className="input-field"
            placeholder="Ex: Retrait vers espèces…"
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
          <Check size={16} /> Transférer
        </button>
      </div>
    </>
  );
}
