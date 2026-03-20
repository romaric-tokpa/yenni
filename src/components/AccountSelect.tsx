"use client";

import type { ReactNode } from "react";
import type { AccountWithBalance } from "@/lib/types";
import { formatCFA, isVaultAccountLocked } from "@/lib/constants";
export interface AccountSelectProps {
  accounts: AccountWithBalance[];
  value: number;
  onChange: (id: number) => void;
  label?: string;
  required?: boolean;
  /** Si true : masque les comptes coffre encore verrouillés (sorties). */
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

  const filtered = active.filter((a) => {
    if (filterType === "all") return true;
    if (a.kind === "vault" && excludeVault && isVaultAccountLocked(a.vault_unlocks_on)) {
      return false;
    }
    return true;
  });

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
          const locked = a.kind === "vault" && isVaultAccountLocked(a.vault_unlocks_on);
          const pos = a.balance >= 0;
          return (
            <option key={a.id} value={a.id}>
              {locked ? "🔒 " : ""}
              {a.name} — {formatCFA(a.balance)} F{pos ? "" : " (négatif)"}
            </option>
          );
        })}
      </select>
      {selected && lockedVaultLine(selected)}
      {shortfall != null && (
        <p className="text-[11px] text-red-400 flex items-center gap-1">
          ⚠️ Solde insuffisant ({formatCFA(selected!.balance)} F disponible, manque {formatCFA(shortfall)} F)
        </p>
      )}
    </div>
  );
}

function lockedVaultLine(a: AccountWithBalance): ReactNode {
  if (a.kind !== "vault" || !isVaultAccountLocked(a.vault_unlocks_on)) return null;
  const d = a.vault_unlocks_on ?? "";
  const [y, m, day] = d.split("-").map(Number);
  const label =
    y && m && day
      ? `${String(day).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`
      : d;
  return (
    <p className="text-[11px] text-slate-500 flex items-center gap-1">
      🔒 Coffre verrouillé jusqu’au {label}
    </p>
  );
}
