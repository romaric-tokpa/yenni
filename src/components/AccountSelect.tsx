"use client";

import type { AccountWithBalance } from "@/lib/types";
import { formatCFA } from "@/lib/constants";
export interface AccountSelectProps {
  accounts: AccountWithBalance[];
  value: number;
  onChange: (id: number) => void;
  label?: string;
  required?: boolean;
  /** Conservé pour compatibilité ; sans effet (plus de comptes à sorties bloquées). */
  excludeVault?: boolean;
  filterType?: "debit" | "credit" | "all";
  id?: string;
  className?: string;
  disabled?: boolean;
  /** Montant à débiter : affiche un avertissement si solde insuffisant */
  debitAmount?: number;
}

export default function AccountSelect({
  accounts,
  value,
  onChange,
  label = "Compte",
  required = true,
  excludeVault = false,
  filterType = "all",
  id,
  className = "input-field w-full text-sm",
  disabled = false,
  debitAmount,
}: AccountSelectProps) {
  const active = accounts.filter((a) => !a.is_archived);
  void excludeVault;
  void filterType;
  const filtered = active;

  const selected = filtered.find((a) => a.id === value);
  const shortfall =
    debitAmount != null &&
    debitAmount > 0 &&
    selected &&
    selected.balance < debitAmount
      ? debitAmount - selected.balance
      : null;

  if (filtered.length === 0) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
        Crée d’abord un compte dans <strong>Réglages → Trésorerie</strong>.
      </div>
    );
  }

  return (
    <div className="grid gap-1.5">
      {label ? (
        <label htmlFor={id} className="text-xs text-slate-400">
          {label}
          {required ? <span className="text-red-400/80"> *</span> : null}
        </label>
      ) : null}
      <select
        id={id}
        className={className}
        value={value && filtered.some((a) => a.id === value) ? value : ""}
        required={required}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v ? parseInt(v, 10) : 0);
        }}
      >
        <option value="">Choisir un compte…</option>
        {filtered.map((a) => {
          const pos = a.balance >= 0;
          return (
            <option key={a.id} value={a.id}>
              {a.name} — {formatCFA(a.balance)} F{pos ? "" : " (négatif)"}
            </option>
          );
        })}
      </select>
      {shortfall != null && (
        <p className="text-[11px] text-red-400 flex items-center gap-1">
          ⚠️ Solde insuffisant ({formatCFA(selected!.balance)} F disponible, manque {formatCFA(shortfall)} F)
        </p>
      )}
    </div>
  );
}
