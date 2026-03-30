"use client";

import { useState, useEffect } from "react";
import { Check, X, Coins } from "lucide-react";
import { formatCFA, suggestedTransactionFeePercentFromAccount } from "@/lib/constants";
import type { BudgetContextValue } from "./types";

interface ModalPurchaseWishProps {
  onClose: () => void;
  budget: BudgetContextValue;
  listId: string;
  itemId: string;
}

export default function ModalPurchaseWish({ onClose, budget, listId, itemId }: ModalPurchaseWishProps) {
  const { addLoan, showToast, accountsWithBalance } = budget;
  const activeAccounts = accountsWithBalance.filter((a) => !a.is_archived);
  const debitAccounts = activeAccounts;
  const defaultAcc = debitAccounts[0]?.id;
  const now = new Date();
  const defaultDueDate = new Date(now);
  defaultDueDate.setDate(defaultDueDate.getDate() + 7);
  const [amount, setAmount] = useState("");
  const [item, setItem] = useState<{ name: string; estimated_amount: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [changeLeft, setChangeLeft] = useState(false);
  const [changeForm, setChangeForm] = useState({
    amount: "",
    merchant: "",
    dueDate: defaultDueDate.toISOString().split("T")[0],
  });
  const [transactionFee, setTransactionFee] = useState("");
  const [accountId, setAccountId] = useState("");

  const accIdResolved = accountId ? Number(accountId) : defaultAcc;
  const selectedAcc = debitAccounts.find((a) => a.id === accIdResolved) ?? debitAccounts[0];
  const feePctFromAccount = suggestedTransactionFeePercentFromAccount(selectedAcc?.kind, selectedAcc?.subtype);

  useEffect(() => {
    if (!listId || !itemId) return;
    fetch(`/api/wish-lists/${listId}/items`)
      .then((r) => r.ok ? r.json() : [])
      .then((items: { id: number; name: string; estimated_amount: number }[]) => {
        const found = items.find((i) => String(i.id) === itemId);
        setItem(found ?? null);
      })
      .catch(() => setItem(null));
  }, [listId, itemId]);

  const handleSubmit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      showToast("Montant requis", "error");
      return;
    }
    if (!defaultAcc) {
      showToast("Aucun compte actif. Ajoute-en un dans Réglages → Trésorerie.", "error");
      return;
    }
    if (changeLeft && changeForm.amount && Number(changeForm.amount) > 0) {
      const changeAmt = Number(changeForm.amount);
      if (changeAmt >= amt) {
        showToast("La monnaie ne peut pas être supérieure ou égale au montant payé", "error");
        return;
      }
      if (!changeForm.merchant.trim()) {
        showToast("Indique le nom du commerçant", "error");
        return;
      }
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/wish-lists/${listId}/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "purchase",
          actual_amount: amt,
          transaction_fee: transactionFee ? Number(transactionFee) : 0,
          account_id: accountId ? Number(accountId) : defaultAcc,
        }),
      });
      if (!r.ok) {
        showToast("Erreur", "error");
        return;
      }

      if (changeLeft && changeForm.amount && Number(changeForm.amount) > 0 && changeForm.merchant.trim()) {
        const changeAmt = Number(changeForm.amount);
        const merchant = changeForm.merchant.trim();
        const label = `Monnaie chez ${merchant}`;
        await addLoan(
          {
            type: "personal_lent",
            label,
            lender_borrower: merchant,
            total_amount: changeAmt,
            remaining_amount: changeAmt,
            interest_rate: 0,
            fees: 0,
            monthly_payment: 0,
            start_date: now.toISOString().split("T")[0],
            end_date: changeForm.dueDate,
            next_due_date: changeForm.dueDate,
            notes: `Monnaie laissée lors de l'achat: ${item?.name ?? ""}`,
            status: "active",
          },
          false,
          0,
          undefined,
          true
        );
        showToast("Envie achetée et monnaie suivie dans Prêts !");
      } else {
        showToast("Envie marquée comme achetée !");
      }
      onClose();
    } catch {
      showToast("Erreur réseau", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!item && itemId) return <div className="text-slate-500 text-sm py-4">Chargement...</div>;
  if (!item) return null;

  return (
    <>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-base lg:text-lg font-bold flex items-center gap-2">
          <Check size={18} className="text-emerald-400" /> Marquer comme acheté
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1"><X size={20} /></button>
      </div>
      <p className="text-sm text-slate-400 mb-4">{item.name}</p>
      <p className="text-xs text-slate-500 mb-2">Budget prévu : {formatCFA(item.estimated_amount)}</p>
      <div>
        <label className="text-xs text-neutral-500 mb-1.5 block">
          {changeLeft ? "Montant total payé (FCFA) *" : "Prix réel d'achat (FCFA) *"}
        </label>
        <input
          type="number"
          className="input-field font-mono"
          placeholder="0"
          value={amount}
          onChange={(e) => {
            const amt = e.target.value;
            const suggested = feePctFromAccount > 0 && amt ? Math.round(Number(amt) * feePctFromAccount / 100) : "";
            setAmount(amt);
            setTransactionFee(String(suggested));
          }}
        />
        {changeLeft && (
          <p className="text-[10px] text-slate-500 mt-1">Ce qui est sorti de ta poche (ex: 10000 si tu as donné 10000)</p>
        )}
      </div>
      <div>
        <label className="text-xs text-neutral-500 mb-1.5 block">Compte débité</label>
        <select
          className="input-field"
          value={accountId || (defaultAcc ? String(defaultAcc) : "")}
          onChange={(e) => {
            const v = e.target.value;
            const nextId = v ? Number(v) : defaultAcc;
            const acc = debitAccounts.find((a) => a.id === nextId) ?? debitAccounts[0];
            const pct = suggestedTransactionFeePercentFromAccount(acc?.kind, acc?.subtype);
            const suggested = pct > 0 && amount ? Math.round(Number(amount) * pct / 100) : "";
            setAccountId(v);
            setTransactionFee(String(suggested));
          }}
        >
          {debitAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>
      {feePctFromAccount > 0 && (
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Frais de transaction (FCFA)</label>
          <input
            type="number"
            className="input-field font-mono"
            placeholder="0"
            min="0"
            value={transactionFee}
            onChange={(e) => setTransactionFee(e.target.value)}
          />
          <p className="text-[10px] text-slate-500 mt-1">~{feePctFromAccount}% du montant (selon le type de compte). Modifiable si tes frais diffèrent.</p>
        </div>
      )}
      <p className="text-[10px] text-slate-500 mt-2">Une dépense sera créée (montant sorti de ta trésorerie).</p>

      {/* Monnaie laissée chez le commerçant */}
      <div className="pt-4 mt-4 border-t border-white/5 space-y-3">
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
              <p className="text-[10px] text-slate-500 mt-1">Ex: 3000 si tu as donné 10000 pour un article à 7000</p>
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Commerçant / Boutique *</label>
              <input className="input-field" placeholder="Ex: Boutique..." value={changeForm.merchant} onChange={(e) => setChangeForm({ ...changeForm, merchant: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">À récupérer avant le</label>
              <input type="date" className="input-field" value={changeForm.dueDate} onChange={(e) => setChangeForm({ ...changeForm, dueDate: e.target.value })} />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-6">
        <button type="button" onClick={onClose} className="flex-1 py-3 rounded-lg border border-white/10 text-neutral-400 hover:text-white text-sm font-medium transition-colors">
          Annuler
        </button>
        <button type="button" onClick={handleSubmit} disabled={loading} className="btn-primary flex-1 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
          {loading ? "…" : <><Check size={16} /> Valider</>}
        </button>
      </div>
    </>
  );
}
