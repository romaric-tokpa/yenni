"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useBudgetContext } from "@/contexts/BudgetContext";
import { formatCFA, accountTypeLabel } from "@/lib/constants";
import type { AccountWithBalance, AccountTransfer } from "@/lib/types";
import AccountGlyph from "@/components/ui/AccountGlyph";
import {
  Wallet,
  Plus,
  ArrowRightLeft,
  Trash2,
  X,
  Check,
  Archive,
  ArchiveRestore,
  ChevronLeft,
  TrendingUp,
  Landmark,
  History,
  Loader2,
  Pencil,
  RefreshCw,
} from "lucide-react";

export default function AccountsManageView() {
  const { showToast, accountsWithBalance, accountsRevision, fetchAccounts } = useBudgetContext();
  const [refreshing, setRefreshing] = useState(false);
  const [transferList, setTransferList] = useState<AccountTransfer[]>([]);
  const [showTransfer, setShowTransfer] = useState(false);
  const [xferForm, setXferForm] = useState({
    from_account_id: "",
    to_account_id: "",
    amount: "",
    fee: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const loadTransfers = useCallback(async () => {
    const r = await fetch("/api/account-transfers?limit=30");
    if (r.ok) setTransferList(await r.json());
  }, []);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers, accountsWithBalance]);

  useEffect(() => {
    if (accountsRevision <= 0) return;
    void loadTransfers();
  }, [accountsRevision, loadTransfers]);

  const activeAccounts = accountsWithBalance.filter((a) => !a.is_archived);
  const transferFromAccounts = activeAccounts;

  const stats = useMemo(() => {
    const active = accountsWithBalance.filter((a) => !a.is_archived);
    const total = active.reduce((s, a) => s + a.balance, 0);
    const archived = accountsWithBalance.filter((a) => a.is_archived).length;
    return {
      total,
      activeCount: active.length,
      archivedCount: archived,
    };
  }, [accountsWithBalance]);

  const sortedAccounts = useMemo(() => {
    return [...accountsWithBalance].sort((a, b) => {
      if (a.is_archived !== b.is_archived) return a.is_archived ? 1 : -1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id;
    });
  }, [accountsWithBalance]);

  const handleTransfer = async () => {
    const from = parseInt(xferForm.from_account_id, 10);
    const to = parseInt(xferForm.to_account_id, 10);
    const amount = Math.round(Number(xferForm.amount));
    if (!from || !to || amount <= 0) {
      showToast("Comptes et montant requis", "error");
      return;
    }
    const r = await fetch("/api/account-transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_account_id: from,
        to_account_id: to,
        amount,
        fee: xferForm.fee ? Math.round(Number(xferForm.fee)) : 0,
        date: xferForm.date,
        notes: xferForm.notes,
      }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      showToast(e.error || "Erreur", "error");
      return;
    }
    showToast("Transfert enregistré !");
    setShowTransfer(false);
    setXferForm({
      from_account_id: "",
      to_account_id: "",
      amount: "",
      fee: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    await Promise.all([fetchAccounts(), loadTransfers()]);
  };

  const toggleArchive = async (a: AccountWithBalance) => {
    const r = await fetch(`/api/accounts/${a.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_archived: !a.is_archived }),
    });
    if (r.ok) {
      showToast(a.is_archived ? "Compte réactivé" : "Compte archivé");
      await fetchAccounts();
    }
  };

  const removeAccount = async (a: AccountWithBalance) => {
    if (!confirm(`Supprimer « ${a.name} » ?`)) return;
    const r = await fetch(`/api/accounts/${a.id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      showToast(j.error || "Suppression impossible", "error");
      return;
    }
    showToast("Compte supprimé");
    await fetchAccounts();
  };

  const deleteTransfer = async (id: number) => {
    if (!confirm("Supprimer ce transfert ?")) return;
    const r = await fetch(`/api/account-transfers?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      showToast("Transfert supprimé", "info");
      await Promise.all([fetchAccounts(), loadTransfers()]);
    }
  };

  const accountName = (id: number) => accountsWithBalance.find((x) => x.id === id)?.name ?? `#${id}`;

  const loadingAccounts = accountsWithBalance.length === 0;

  const handleRefreshAccounts = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchAccounts();
    } finally {
      setRefreshing(false);
    }
  }, [fetchAccounts]);

  return (
    <div className="animate-slide-up pb-20 lg:pb-8 max-w-5xl mx-auto">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-4 transition-colors group"
      >
        <span className="rounded-lg bg-white/5 p-1 group-hover:bg-white/10 transition-colors">
          <ChevronLeft size={16} />
        </span>
        Réglages
      </Link>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-5 lg:mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2 text-slate-100">
            <Landmark size={24} className="text-emerald-400" strokeWidth={1.75} />
            Trésorerie
          </h1>
          <p className="text-slate-500 text-xs lg:text-sm mt-1 max-w-xl">
            Tous tes comptes au même endroit : mouvements, soldes et transferts entre comptes (hors budget).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleRefreshAccounts()}
            disabled={refreshing || loadingAccounts}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-emerald-400 transition-colors disabled:opacity-50"
            title="Actualiser les comptes"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={() => setShowTransfer(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-colors border border-white/10"
          >
            <ArrowRightLeft size={14} className="text-emerald-400" />
            Transfert
          </button>
          <Link
            href="/settings/accounts/new"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-semibold transition-colors border border-emerald-500/20"
          >
            <Plus size={14} />
            Nouveau compte
          </Link>
        </div>
      </div>

      {!loadingAccounts && (
        <div className="rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.07] to-transparent p-4 lg:p-5 mb-5">
          <div className="text-[11px] font-semibold text-emerald-400/90 mb-3 flex items-center gap-2">
            <Wallet size={14} /> Synthèse
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/8 bg-black/20 p-3 text-center sm:text-left">
              <div className="text-[10px] text-slate-500 flex items-center justify-center sm:justify-start gap-1">
                <TrendingUp size={10} /> Solde total (actifs)
              </div>
              <div
                className={`font-mono text-lg font-bold mt-1 tabular-nums ${
                  stats.total >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {formatCFA(stats.total)}
              </div>
            </div>
            <div className="rounded-xl border border-white/8 bg-black/20 p-3 text-center sm:text-left">
              <div className="text-[10px] text-slate-500 flex items-center justify-center sm:justify-start gap-1">
                <Wallet size={10} /> Comptes actifs
              </div>
              <div className="font-mono text-lg font-bold text-slate-100 mt-1 tabular-nums">{stats.activeCount}</div>
            </div>
            <div className="rounded-xl border border-white/8 bg-black/20 p-3 text-center sm:text-left">
              <div className="text-[10px] text-slate-500 flex items-center justify-center sm:justify-start gap-1">
                <Archive size={10} /> Archivés
              </div>
              <div className="font-mono text-lg font-bold text-slate-400 mt-1 tabular-nums">{stats.archivedCount}</div>
            </div>
          </div>
        </div>
      )}

      <section className="mb-8">
        <div className="text-[11px] font-semibold text-emerald-400/90 mb-3 flex items-center gap-2">
          <Landmark size={14} className="opacity-90" />
          Mes comptes
        </div>

        {loadingAccounts ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
            <Loader2 className="mx-auto mb-4 h-9 w-9 text-emerald-400/80 animate-spin" />
            <p className="text-slate-500 text-sm">Chargement des comptes…</p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:gap-4">
              {sortedAccounts.map((a) => {
                const accent = a.color || "#6366f1";
                const hasLogo = a.logo_url?.trim().startsWith("data:image/");
                return (
                  <li key={a.id}>
                    <div
                      className={`
                        group relative flex flex-col sm:flex-row rounded-2xl border transition-all duration-200 overflow-hidden
                        ${
                          a.is_archived
                            ? "border-white/[0.06] bg-white/[0.02] opacity-70"
                            : "border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.04] to-white/[0.02] hover:border-emerald-500/30"
                        }
                      `}
                    >
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                        style={{ background: a.is_archived ? "transparent" : accent }}
                        aria-hidden
                      />
                      <Link
                        href={`/settings/accounts/${a.id}`}
                        className="flex flex-1 min-w-0 flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5 pl-5 sm:pl-6 text-left transition-colors hover:bg-white/[0.03]"
                      >
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ring-1 ring-white/10 shadow-inner overflow-hidden"
                          style={{
                            background: hasLogo ? "rgba(255,255,255,0.06)" : accent + "22",
                          }}
                        >
                          <AccountGlyph account={a} size={26} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 gap-y-1">
                            <span className="font-semibold text-slate-100 text-base tracking-tight">{a.name}</span>
                            {a.is_archived && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md bg-neutral-500/25 text-neutral-400 border border-white/5">
                                Archivé
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-500 mt-1 leading-snug">
                            {accountTypeLabel(a.kind, a.subtype, a.institution_name)}
                          </p>
                          <p className="text-[10px] text-emerald-500/70 mt-2 font-medium">Voir les mouvements →</p>
                        </div>

                        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 sm:min-w-[120px] px-4 pb-4 sm:p-5 sm:pl-0">
                          <div className="text-right sm:text-right">
                            <div
                              className={`font-mono text-lg sm:text-xl font-bold tabular-nums ${
                                a.balance >= 0 ? "text-emerald-400" : "text-red-400"
                              }`}
                            >
                              {formatCFA(a.balance)}
                            </div>
                            <div className="text-[10px] text-neutral-500">FCFA · solde courant</div>
                          </div>
                        </div>
                      </Link>

                      <div className="flex items-center justify-end gap-1 border-t border-white/[0.06] bg-black/20 px-3 py-2 sm:flex-col sm:justify-center sm:border-l sm:border-t-0 sm:min-w-[56px] sm:px-2">
                        <Link
                          href={`/settings/accounts/${a.id}/edit`}
                          className="p-2.5 rounded-lg text-neutral-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                          title="Modifier le compte"
                          aria-label={`Modifier ${a.name}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Pencil size={17} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => toggleArchive(a)}
                          className="p-2.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                          title={a.is_archived ? "Réactiver" : "Archiver"}
                        >
                          {a.is_archived ? <ArchiveRestore size={17} /> : <Archive size={17} />}
                        </button>
                        {!a.is_archived && (
                          <button
                            type="button"
                            onClick={() => removeAccount(a)}
                            className="p-2.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={17} />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <div className="text-[11px] font-semibold text-emerald-400/90 mb-3 flex items-center gap-2">
          <History size={14} className="text-emerald-400/90" />
          Transferts récents
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            {transferList.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                  <ArrowRightLeft size={22} className="text-neutral-500" />
                </div>
                <p className="text-neutral-400 text-sm font-medium">Aucun transfert enregistré</p>
                <p className="text-neutral-600 text-xs mt-1 max-w-xs mx-auto">
                  Déplace de l’argent entre deux comptes sans créer de dépense ni de revenu.
                </p>
                <button
                  type="button"
                  onClick={() => setShowTransfer(true)}
                  className="mt-5 text-sm font-medium text-emerald-400 hover:text-emerald-300"
                >
                  Faire un transfert →
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {transferList.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 sm:px-5 py-4 hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-white/5 border border-white/10 font-mono text-[11px] text-neutral-400">
                        {t.date}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0 text-sm">
                      <span className="text-neutral-200 font-medium truncate max-w-[40%] sm:max-w-none">
                        {accountName(t.from_account_id)}
                      </span>
                      <ArrowRightLeft size={14} className="text-emerald-500/70 shrink-0" />
                      <span className="text-neutral-200 font-medium truncate max-w-[40%] sm:max-w-none">
                        {accountName(t.to_account_id)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 sm:ml-auto">
                      <div className="text-right">
                        <div className="font-mono font-semibold text-amber-400 tabular-nums">{formatCFA(t.amount)}</div>
                        {t.fee > 0 && (
                          <div className="text-[10px] text-neutral-500">+ {formatCFA(t.fee)} frais</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteTransfer(t.id)}
                        className="p-2 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        aria-label="Supprimer le transfert"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </div>
      </section>

      {showTransfer && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowTransfer(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-white/[0.08] bg-[var(--bg-elevated)] shadow-2xl shadow-black/50 p-6 max-h-[92dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/25">
                    <ArrowRightLeft size={18} className="text-emerald-400" />
                  </span>
                  Transfert
                </h2>
                <p className="text-xs text-neutral-500 mt-2 leading-relaxed pr-4">
                  Montant débité sur la source et crédité sur la destination. Les frais optionnels restent sur la source.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTransfer(false)}
                className="rounded-lg p-2 text-neutral-500 hover:text-white hover:bg-white/5 shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-3 mt-5">
              <div>
                <label className="text-xs font-medium text-neutral-400 mb-1.5 block">Compte source</label>
                <select
                  className="input-field"
                  value={xferForm.from_account_id}
                  onChange={(e) => setXferForm({ ...xferForm, from_account_id: e.target.value })}
                >
                  <option value="">— Choisir —</option>
                  {transferFromAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatCFA(a.balance)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 mb-1.5 block">Compte destination</label>
                <select
                  className="input-field"
                  value={xferForm.to_account_id}
                  onChange={(e) => setXferForm({ ...xferForm, to_account_id: e.target.value })}
                >
                  <option value="">— Choisir —</option>
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-neutral-400 mb-1.5 block">Montant (FCFA)</label>
                  <input
                    type="number"
                    className="input-field font-mono"
                    value={xferForm.amount}
                    onChange={(e) => setXferForm({ ...xferForm, amount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-400 mb-1.5 block">Frais (FCFA)</label>
                  <input
                    type="number"
                    className="input-field font-mono"
                    value={xferForm.fee}
                    onChange={(e) => setXferForm({ ...xferForm, fee: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 mb-1.5 block">Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={xferForm.date}
                  onChange={(e) => setXferForm({ ...xferForm, date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 mb-1.5 block">Notes</label>
                <input
                  className="input-field"
                  value={xferForm.notes}
                  onChange={(e) => setXferForm({ ...xferForm, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-7">
              <button
                type="button"
                className="flex-1 py-3.5 rounded-xl border border-white/15 text-neutral-300 font-medium hover:bg-white/5"
                onClick={() => setShowTransfer(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn-primary flex-1 py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2"
                onClick={handleTransfer}
              >
                <Check size={18} /> Transférer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
