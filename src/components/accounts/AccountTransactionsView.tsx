"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBudgetContext } from "@/contexts/BudgetContext";
import { formatCFA, accountTypeLabel } from "@/lib/constants";
import { getIncomeSourceLabel } from "@/lib/incomeSources";
import type { Account, AccountWithBalance, Expense, Income, AccountTransfer } from "@/lib/types";
import AccountGlyph from "@/components/ui/AccountGlyph";
import {
  ChevronLeft,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Loader2,
  Receipt,
  Wallet,
  Pencil,
} from "lucide-react";

type ApiResponse = {
  account: Account;
  balance: number;
  accountNames?: Record<string, string>;
  expenses: Expense[];
  incomes: Income[];
  transfers: AccountTransfer[];
};

type TimelineRow =
  | {
      key: string;
      kind: "expense" | "income";
      date: string;
      time: string;
      sortKey: string;
      label: string;
      subtitle: string;
      amount: number;
      signedDelta: number;
      icon: typeof ArrowUpRight;
      accent: string;
    }
  | {
      key: string;
      kind: "transfer_in" | "transfer_out";
      date: string;
      time: string;
      sortKey: string;
      label: string;
      subtitle: string;
      amount: number;
      signedDelta: number;
      fee?: number;
      otherAccountId: number;
      icon: typeof ArrowRightLeft;
      accent: string;
    };

function padTime(t: string): string {
  const p = (t || "00:00").split(":");
  return `${(p[0] || "00").padStart(2, "0")}:${(p[1] || "00").padStart(2, "0")}`;
}

export default function AccountTransactionsView({ accountId }: { accountId: number }) {
  const router = useRouter();
  const { accountsRevision } = useBudgetContext();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (mode: "full" | "soft" = "full") => {
    const soft = mode === "soft";
    if (soft) setRefreshing(true);
    else {
      setLoading(true);
      setError(null);
    }
    try {
      const r = await fetch(`/api/accounts/${accountId}/transactions`);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error || "Impossible de charger le compte");
        setData(null);
        return;
      }
      setData(await r.json());
      if (!soft) setError(null);
    } catch {
      if (!soft) {
        setError("Erreur réseau");
        setData(null);
      }
    } finally {
      if (soft) setRefreshing(false);
      else setLoading(false);
    }
  }, [accountId]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    void load("full");
  }, [accountId, load]);

  /** Dépense/revenu/transfert, édition compte, autre onglet : resynchroniser mouvements et solde. */
  useEffect(() => {
    if (accountsRevision <= 0) return;
    void loadRef.current("soft");
  }, [accountsRevision]);

  const accountNameMap = useMemo(() => {
    const m = new Map<number, string>();
    if (!data) return m;
    m.set(data.account.id, data.account.name);
    const raw = data.accountNames ?? {};
    for (const [idStr, name] of Object.entries(raw)) {
      const n = parseInt(idStr, 10);
      if (!Number.isNaN(n)) m.set(n, name);
    }
    return m;
  }, [data]);

  const timeline = useMemo((): TimelineRow[] => {
    if (!data) return [];

    const rows: TimelineRow[] = [];

    for (const e of data.expenses) {
      const total = e.amount + (e.transaction_fee ?? 0);
      const sk = `${e.date}T${padTime(e.time)}:e:${e.id}`;
      rows.push({
        key: `e-${e.id}`,
        kind: "expense",
        date: e.date,
        time: e.time || "00:00",
        sortKey: sk,
        label: e.description || "Dépense",
        subtitle: e.category ? `Catégorie · ${e.category}` : "Dépense",
        amount: total,
        signedDelta: -total,
        icon: ArrowUpRight,
        accent: "#f87171",
      });
    }

    for (const i of data.incomes) {
      const sk = `${i.date}T${padTime(i.time)}:i:${i.id}`;
      rows.push({
        key: `i-${i.id}`,
        kind: "income",
        date: i.date,
        time: i.time || "00:00",
        sortKey: sk,
        label: i.description || "Revenu",
        subtitle: i.source ? `Type · ${getIncomeSourceLabel(i.source)}` : "Revenu",
        amount: i.amount,
        signedDelta: i.amount,
        icon: ArrowDownLeft,
        accent: "#34d399",
      });
    }

    for (const t of data.transfers) {
      const isOut = t.from_account_id === accountId;
      const other = isOut ? t.to_account_id : t.from_account_id;
      const sk = `${t.date}T${padTime(t.time)}:t:${t.id}`;
      rows.push({
        key: `t-${t.id}`,
        kind: isOut ? "transfer_out" : "transfer_in",
        date: t.date,
        time: t.time || "00:00",
        sortKey: sk,
        label: isOut ? "Transfert vers un autre compte" : "Transfert reçu",
        subtitle: "",
        amount: t.amount,
        signedDelta: isOut ? -(t.amount + (t.fee ?? 0)) : t.amount,
        fee: t.fee > 0 ? t.fee : undefined,
        otherAccountId: other,
        icon: ArrowRightLeft,
        accent: "#fb923c",
      });
    }

    rows.sort((a, b) => (a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0));
    return rows;
  }, [data, accountId]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 py-16">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-500/80" aria-hidden />
        <p className="text-sm text-neutral-500">Chargement des mouvements…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-neutral-400">{error || "Compte introuvable"}</p>
        <Link
          href="/settings/accounts"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-emerald-400 hover:text-emerald-300"
        >
          <ChevronLeft size={18} /> Retour à la trésorerie
        </Link>
      </div>
    );
  }

  const acc = data.account as AccountWithBalance;
  const hasLogo = acc.logo_url?.trim().startsWith("data:image/");
  const accent = acc.color || "#6366f1";

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 animate-slide-up">
      <div className="mb-8 flex items-start gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-1 rounded-xl border border-white/10 bg-white/5 p-2.5 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Retour"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl ring-1 ring-white/10"
            style={{ background: hasLogo ? "rgba(255,255,255,0.06)" : accent + "22" }}
          >
            <AccountGlyph account={acc} size={28} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-lg font-bold tracking-tight text-white truncate">{acc.name}</h1>
                {refreshing && (
                  <Loader2
                    className="h-4 w-4 shrink-0 animate-spin text-emerald-400/80"
                    aria-label="Actualisation des données"
                  />
                )}
              </div>
              <Link
                href={`/settings/accounts/${accountId}/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-emerald-400/90 hover:bg-emerald-500/15 hover:text-emerald-300 transition-colors shrink-0"
              >
                <Pencil size={14} strokeWidth={2} />
                Modifier
              </Link>
            </div>
            <p className="text-xs text-neutral-500">{accountTypeLabel(acc.kind, acc.subtype, acc.institution_name)}</p>
            <p
              className={`mt-2 font-mono text-xl font-bold tabular-nums ${data.balance >= 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              {formatCFA(data.balance)} <span className="text-xs font-normal text-neutral-500">FCFA</span>
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Receipt size={18} className="text-emerald-400/90" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">Mouvements</h2>
        <span className="text-[11px] text-neutral-600">({timeline.length})</span>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
        {timeline.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Wallet className="mx-auto mb-3 h-11 w-11 text-neutral-600" />
            <p className="text-sm text-neutral-400">Aucune opération enregistrée sur ce compte</p>
            <p className="mt-2 text-xs text-neutral-600">
              Les dépenses, revenus et transferts associés apparaîtront ici.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {timeline.map((row) => {
              const Icon = row.icon;
              const pos = row.signedDelta >= 0;
              return (
                <li key={row.key} className="flex gap-3 px-4 py-3.5 sm:px-5 hover:bg-white/[0.03]">
                  <div
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20"
                    style={{ color: row.accent }}
                  >
                    <Icon size={18} strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-medium text-neutral-100">{row.label}</span>
                      <span className="text-[11px] text-neutral-500 tabular-nums">
                        {row.date}
                        {row.time && row.time !== "00:00" ? ` · ${row.time}` : ""}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {row.kind === "transfer_in" || row.kind === "transfer_out" ? (
                        <>
                          {row.kind === "transfer_out" ? "Vers" : "Depuis"}{" "}
                          <span className="text-neutral-300">
                            {accountNameMap.get(row.otherAccountId) ?? `compte #${row.otherAccountId}`}
                          </span>
                        </>
                      ) : (
                        row.subtitle
                      )}
                    </p>
                    {row.kind === "transfer_out" && row.fee != null && row.fee > 0 && (
                      <p className="text-[10px] text-amber-400/80 mt-1">+ {formatCFA(row.fee)} frais</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={`font-mono text-sm font-semibold tabular-nums ${
                        row.kind === "transfer_in" || row.kind === "transfer_out"
                          ? "text-orange-400"
                          : pos
                            ? "text-emerald-400"
                            : "text-red-400"
                      }`}
                    >
                      {pos ? "+" : "−"}
                      {formatCFA(Math.abs(row.signedDelta))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-6 text-center text-[11px] text-neutral-600">
        Solde = solde initial + entrées − sorties (y compris frais de transfert sortant).
      </p>
    </div>
  );
}
