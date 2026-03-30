"use client";

import { useState } from "react";
import { Plus, X, Check, Coins } from "lucide-react";
import { suggestedTransactionFeePercentFromAccount } from "@/lib/constants";
import type { Category } from "@/lib/types";
import type { BudgetContextValue } from "./types";

interface ModalNewExpenseProps {
  onClose: () => void;
  budget: BudgetContextValue;
}

export default function ModalNewExpense({ onClose, budget }: ModalNewExpenseProps) {
  const { config, addExpense, addLoan, showToast, accountsWithBalance } = budget;
  const activeAccounts = accountsWithBalance.filter((a) => !a.is_archived);
  const debitAccounts = activeAccounts;
  const defaultAcc = debitAccounts[0]?.id;
  const now = new Date();
  const defaultDueDate = new Date(now);
  defaultDueDate.setDate(defaultDueDate.getDate() + 7);
  const [form, setForm] = useState({
    date: now.toISOString().split("T")[0],
    time: now.toTimeString().slice(0, 5),
    description: "",
    category: config.categories[0]?.id || "food",
    amount: "",
    notes: "",
    transaction_fee: "",
    account_id: "" as string,
  });
  const [changeLeft, setChangeLeft] = useState(false);
  const [changeForm, setChangeForm] = useState({
    amount: "",
    merchant: "",
    dueDate: defaultDueDate.toISOString().split("T")[0],
  });

  const accIdResolved = form.account_id ? Number(form.account_id) : defaultAcc;
  const selectedAccount =
    debitAccounts.find((a) => a.id === accIdResolved) ?? debitAccounts[0];
  const feePercentFromAccount = suggestedTransactionFeePercentFromAccount(
    selectedAccount?.kind,
    selectedAccount?.subtype,
  );

  const handleSubmit = async () => {
    if (!form.description || !form.amount || Number(form.amount) <= 0) {
      showToast("Remplis tous les champs", "error");
      return;
    }
    if (debitAccounts.length === 0) {
      showToast("Aucun compte actif pour payer. Crée un compte dans Réglages → Trésorerie.", "error");
      return;
    }
    const expenseAmount = Number(form.amount);
    if (changeLeft && changeForm.amount && Number(changeForm.amount) > 0) {
      const changeAmt = Number(changeForm.amount);
      if (changeAmt >= expenseAmount) {
        showToast("La monnaie ne peut pas être supérieure ou égale au montant payé", "error");
        return;
      }
      if (!changeForm.merchant.trim()) {
        showToast("Indique le nom du commerçant", "error");
        return;
      }
    }
    const fee = form.transaction_fee ? Number(form.transaction_fee) : 0;
    const accId = accIdResolved;
    const ok = await addExpense({
      ...form,
      amount: expenseAmount,
      time: form.time || "00:00",
      payment_method: "cash",
      transaction_fee: fee,
      account_id: accId,
    });
    if (!ok) return;

    if (changeLeft && changeForm.amount && Number(changeForm.amount) > 0 && changeForm.merchant.trim()) {
      const amt = Number(changeForm.amount);
      const merchant = changeForm.merchant.trim();
      const label = `Monnaie chez ${merchant}`;
      await addLoan(
        {
          type: "personal_lent",
          label,
          lender_borrower: merchant,
          total_amount: amt,
          remaining_amount: amt,
          interest_rate: 0,
          fees: 0,
          monthly_payment: 0,
          start_date: form.date,
          end_date: changeForm.dueDate,
          next_due_date: changeForm.dueDate,
          notes: `Monnaie laissée lors de: ${form.description}`,
          status: "active",
        },
        false,
        0,
        undefined,
        true
      );
      showToast("Dépense enregistrée et monnaie suivie dans Prêts !");
    } else {
      showToast("Dépense enregistrée !");
    }
    onClose();
  };

  return (
    <>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-base lg:text-lg font-bold flex items-center gap-2">
          <Plus size={18} className="text-emerald-400" /> Nouvelle Dépense
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1"><X size={20} /></button>
      </div>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Date</label>
            <input type="date" className="input-field" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Heure</label>
            <input type="time" className="input-field" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Description</label>
          <input className="input-field" placeholder="Ex: Courses marché..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
            <label className="text-xs text-neutral-500 mb-1.5 block">
              {changeLeft ? "Montant total payé (FCFA) *" : "Montant (FCFA)"}
            </label>
            <input
              type="number"
              className="input-field font-mono"
              placeholder="0"
              value={form.amount}
              onChange={(e) => {
                const amt = e.target.value;
                const feePct = feePercentFromAccount;
                const suggested = feePct > 0 && amt ? Math.round((Number(amt) * feePct) / 100) : "";
                setForm({ ...form, amount: amt, transaction_fee: String(suggested) });
              }}
            />
            {changeLeft && (
              <p className="text-[10px] text-slate-500 mt-1">Ce qui est sorti de ta poche (ex: 10000 si tu as donné 10000)</p>
            )}
          </div>
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Compte débité</label>
          <select
            className="input-field"
            value={form.account_id || (defaultAcc ? String(defaultAcc) : "")}
            onChange={(e) => {
              const account_id = e.target.value;
              const nextId = account_id ? Number(account_id) : defaultAcc;
              const accRow = debitAccounts.find((a) => a.id === nextId) ?? debitAccounts[0];
              const feePct = suggestedTransactionFeePercentFromAccount(accRow?.kind, accRow?.subtype);
              const suggested =
                feePct > 0 && form.amount ? Math.round((Number(form.amount) * feePct) / 100) : "";
              setForm({ ...form, account_id, transaction_fee: String(suggested) });
            }}
          >
            {debitAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <p className="text-[10px] text-slate-500 mt-1">
            Les frais suggérés dépendent du type de compte (Mobile Money, carte, banque…).
          </p>
        </div>
        {feePercentFromAccount > 0 && (
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Frais de transaction (FCFA)</label>
            <input
              type="number"
              className="input-field font-mono"
              placeholder="0"
              min="0"
              value={form.transaction_fee}
              onChange={(e) => setForm({ ...form, transaction_fee: e.target.value })}
            />
            <p className="text-[10px] text-slate-500 mt-1">
              ~{feePercentFromAccount}% du montant (selon le type du compte). Modifiable si tes frais diffèrent.
            </p>
          </div>
        )}
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Notes (optionnel)</label>
          <input className="input-field" placeholder="Notes..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>

        {/* Monnaie laissée chez le commerçant */}
        <div className="pt-4 border-t border-white/5 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={changeLeft} onChange={(e) => setChangeLeft(e.target.checked)} className="rounded border-white/20" />
            <Coins size={16} className="text-amber-400" />
            Monnaie laissée chez le commerçant (à récupérer plus tard)
          </label>
          {changeLeft && (
            <div className="grid gap-3 pl-6">
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Monnaie à récupérer (FCFA) *</label>
                <input type="number" className="input-field font-mono" placeholder="0" value={changeForm.amount} onChange={(e) => setChangeForm({ ...changeForm, amount: e.target.value })} />
                <p className="text-[10px] text-slate-500 mt-1">Ex: 3000 si tu as donné 10000 pour un achat à 7000</p>
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Commerçant / Boutique *</label>
                <input className="input-field" placeholder="Ex: Épicerie du coin, Boulangerie..." value={changeForm.merchant} onChange={(e) => setChangeForm({ ...changeForm, merchant: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Date prévue de récupération</label>
                <input type="date" className="input-field" value={changeForm.dueDate} onChange={(e) => setChangeForm({ ...changeForm, dueDate: e.target.value })} />
              </div>
              <p className="text-[10px] text-slate-500">Coût réel = montant payé − monnaie. La monnaie sera suivie dans Prêts. Quand tu la récupères, utilise « Encaisser » pour la réintégrer à ta trésorerie.</p>
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-3 mt-6 pt-4 border-t border-white/5">
        <button onClick={onClose} className="flex-1 min-h-[44px] py-3 rounded-lg border border-white/10 text-neutral-400 hover:text-white text-sm font-medium transition-colors">Annuler</button>
        <button onClick={handleSubmit} className="btn-primary flex-1 min-h-[44px] py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5">
          <Check size={16} /> Enregistrer
        </button>
      </div>
    </>
  );
}
