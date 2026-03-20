"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Reorder, useReducedMotion } from "framer-motion";
import type { AccountWithBalance } from "@/lib/types";
import { formatCFA, accountTypeLabel } from "@/lib/constants";
import AccountGlyph from "./ui/AccountGlyph";
import { ChevronRight } from "lucide-react";
import { useBudgetContext } from "@/contexts/BudgetContext";

function GlassAccountCard({ account: a }: { account: AccountWithBalance }) {
  const accent = a.color || "#a1a1aa";
  const positive = a.balance >= 0;

  return (
    <article
      className={`
        group relative w-[min(100%,168px)] shrink-0 snap-center overflow-hidden rounded-xl
        sm:w-[188px]
        transition-[transform,box-shadow] duration-300 ease-out
        will-change-transform
        hover:scale-[1.02] hover:-translate-y-0.5
        hover:shadow-[0_14px_36px_-12px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.1)_inset,0_1px_0_rgba(255,255,255,0.1)_inset]
        active:scale-[0.99] active:translate-y-0 active:duration-150
        motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none
      `}
      style={{
        /* ISO 7810 ID-1 — format carte bancaire (rectangle paysage) */
        aspectRatio: "85.6 / 53.98",
        boxShadow: `
          0 4px 20px rgba(0,0,0,0.32),
          0 0 0 1px rgba(255,255,255,0.06) inset,
          0 1px 0 rgba(255,255,255,0.1) inset
        `,
      }}
    >
      {/* brillance au survol */}
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:hidden">
        <div
          className={`
            absolute inset-y-0 -left-1/3 w-2/3 skew-x-[-18deg]
            bg-gradient-to-r from-transparent via-white/[0.14] to-transparent
            translate-x-[-120%] transition-transform duration-700 ease-out
            group-hover:translate-x-[220%]
          `}
        />
      </div>

      {/* liquide */}
      <div
        className="pointer-events-none absolute -left-1/4 -top-1/2 aspect-square w-[130%] rounded-full opacity-[0.11] blur-[52px] transition-all duration-500 ease-out group-hover:opacity-[0.18] group-hover:scale-105"
        style={{ background: accent }}
      />
      <div
        className="pointer-events-none absolute -right-1/4 bottom-[-20%] aspect-square w-[75%] rounded-full opacity-[0.07] blur-[44px] transition-all duration-500 ease-out group-hover:opacity-[0.12] group-hover:scale-105"
        style={{ background: accent }}
      />

      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/[0.14] via-white/[0.07] to-white/[0.03] transition-opacity duration-300 group-hover:from-white/[0.16]" />
      <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/[0.28] via-transparent to-white/[0.04]" />
      <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/[0.06] transition-[box-shadow,ring-color] duration-300 group-hover:ring-white/[0.12]" />

      <div className="relative z-10 flex h-full min-h-0 flex-col gap-1.5 overflow-hidden p-2.5 sm:gap-2 sm:p-3">
        <div className="flex shrink-0 items-start justify-between gap-2">
          <div
            className={`
              flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg
              border border-white/[0.1] bg-white/[0.08]
              shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]
              transition-transform duration-300 ease-out group-hover:scale-105
            `}
          >
            <AccountGlyph account={a} size={15} />
          </div>
          <div
            className={`
              mt-0.5 h-px flex-1 max-w-[2.5rem] bg-gradient-to-r from-white/0 via-white/12 to-white/0
              opacity-50 transition-all duration-300 group-hover:max-w-[3.5rem] group-hover:via-white/22 group-hover:opacity-90
            `}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col justify-end gap-1 overflow-hidden pb-0">
          <h3 className="min-h-0 shrink break-words text-[11px] font-medium leading-snug tracking-[-0.01em] text-white/90 line-clamp-2 sm:text-xs">
            {a.name}
          </h3>
          <div className="shrink-0">
            <p className="text-[8px] font-semibold uppercase leading-none tracking-[0.1em] text-white/45">
              Type de compte
            </p>
            <p className="mt-0.5 break-words text-[9px] font-medium leading-snug text-white/72 line-clamp-2 sm:text-[10px]">
              {accountTypeLabel(a.kind, a.subtype, a.institution_name)}
            </p>
          </div>
        </div>

        <div className="shrink-0 border-t border-white/[0.08] bg-black/10 pt-1.5 sm:pt-2 transition-colors duration-300 group-hover:border-white/[0.12]">
          <p className="text-[8px] font-medium uppercase leading-none tracking-[0.12em] text-white/35">Solde</p>
          <p
            className={`
              mt-0.5 font-mono text-sm font-semibold tabular-nums leading-none tracking-tight transition-transform duration-300 ease-out group-hover:translate-x-0.5
              sm:text-base
              ${positive ? "text-white/94" : "text-rose-300/95"}
            `}
          >
            {formatCFA(a.balance)}
            <span className="ml-0.5 text-[10px] font-normal text-white/32 sm:text-[11px]">FCFA</span>
          </p>
        </div>
      </div>
    </article>
  );
}

export default function DashboardAccountCards({
  accounts,
  treasurySubLabel,
}: {
  accounts: AccountWithBalance[];
  /** Ex. : « Écritures incluses jusqu’au 31 mars 2025 » */
  treasurySubLabel?: string | null;
}) {
  const { accountsWithBalance, fetchAccounts, showToast } = useBudgetContext();
  const reduceMotion = useReducedMotion();

  const activeSorted = useMemo(() => {
    return accounts
      .filter((a) => !a.is_archived)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id);
  }, [accounts]);

  const baselineKey = useMemo(() => activeSorted.map((a) => a.id).join(","), [activeSorted]);
  const [orderIds, setOrderIds] = useState<number[] | null>(null);

  const effectiveOrderIds = orderIds ?? activeSorted.map((a) => a.id);

  const accountById = useMemo(() => new Map(activeSorted.map((a) => [a.id, a])), [activeSorted]);
  const activeSortedRef = useRef(activeSorted);
  activeSortedRef.current = activeSorted;
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOrderIds(null);
  }, [baselineKey]);

  useEffect(() => {
    return () => {
      if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    };
  }, []);

  const persistOrder = useCallback(
    async (orderedActive: AccountWithBalance[]) => {
      const archived = [...accountsWithBalance]
        .filter((a) => a.is_archived)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id);
      const combined = [...orderedActive, ...archived];
      try {
        const results = await Promise.all(
          combined.map((a, i) =>
            fetch(`/api/accounts/${a.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sort_order: i }),
            }),
          ),
        );
        if (results.some((r) => !r.ok)) throw new Error("order");
        await fetchAccounts();
        setOrderIds(null);
        showToast("Ordre des comptes enregistré sur tous les écrans.");
      } catch {
        setOrderIds(null);
        showToast("Impossible d’enregistrer l’ordre des comptes.", "error");
      }
    },
    [accountsWithBalance, fetchAccounts, showToast],
  );

  const handleReorder = useCallback(
    (newOrder: number[]) => {
      setOrderIds(newOrder);
      if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
      persistDebounceRef.current = setTimeout(() => {
        persistDebounceRef.current = null;
        const map = new Map(activeSortedRef.current.map((a) => [a.id, a]));
        const newActive = newOrder.map((id) => map.get(id)).filter((x): x is AccountWithBalance => x != null);
        if (newActive.length !== newOrder.length) return;
        void persistOrder(newActive);
      }, 350);
    },
    [persistOrder],
  );

  if (activeSorted.length === 0) return null;

  const showReorder = activeSorted.length > 1;

  const reorderSpring = reduceMotion
    ? { type: "tween" as const, duration: 0.2, ease: "easeOut" as const }
    : { type: "spring" as const, stiffness: 520, damping: 32, mass: 0.85 };

  const whileDrag = reduceMotion
    ? { zIndex: 40, cursor: "grabbing" as const }
    : {
        scale: 1.04,
        zIndex: 40,
        cursor: "grabbing" as const,
        boxShadow: "0 20px 40px -12px rgba(0,0,0,0.6), 0 0 0 2px rgba(34,197,94,0.35)",
      };

  return (
    <section className="mb-7" aria-label="Comptes">
      <div className="mb-4 flex flex-col gap-1 rounded-2xl border border-white/[0.06] bg-[var(--bg-elevated)]/95 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
            Mes comptes
          </h2>
          {treasurySubLabel ? (
            <p className="mt-1 text-[10px] leading-snug text-neutral-600">{treasurySubLabel}</p>
          ) : null}
        </div>
        <Link
          href="/settings/accounts"
          className="group inline-flex shrink-0 items-center gap-0.5 self-start text-[11px] font-medium text-neutral-400 transition-colors hover:text-white sm:self-center"
        >
          Réglages
          <ChevronRight size={13} strokeWidth={2} className="opacity-60 transition-transform group-hover:translate-x-px" />
        </Link>
      </div>

      <div className="relative pb-1">
        <div
          className="-mx-0.5 overflow-x-auto px-0.5 py-2 [scrollbar-width:thin]"
          style={{ scrollbarColor: "rgba(255,255,255,0.12) transparent" }}
        >
          {showReorder ? (
            <Reorder.Group
              as="div"
              axis="x"
              values={effectiveOrderIds}
              onReorder={handleReorder}
              className="flex w-max min-w-full flex-row items-stretch gap-3 pr-1"
            >
              {effectiveOrderIds.map((id) => {
                const a = accountById.get(id);
                if (!a) return null;
                return (
                  <Reorder.Item
                    key={id}
                    as="div"
                    value={id}
                    layout="position"
                    transition={reorderSpring}
                    whileDrag={whileDrag}
                    className="relative shrink-0 snap-center list-none rounded-xl outline-none focus-within:ring-2 focus-within:ring-emerald-500/50 focus-within:ring-offset-2 focus-within:ring-offset-[var(--bg-primary)] cursor-grab active:cursor-grabbing touch-pan-y"
                    dragElastic={0.12}
                  >
                    <Link
                      href={`/settings/accounts/${id}`}
                      className="block select-none rounded-xl"
                      draggable={false}
                    >
                      <GlassAccountCard account={a} />
                    </Link>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          ) : (
            <div className="flex w-max flex-row items-stretch gap-3 pr-1">
              {activeSorted.map((a) => (
                <div key={a.id} className="shrink-0 snap-center rounded-xl">
                  <Link
                    href={`/settings/accounts/${a.id}`}
                    className="block outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)] rounded-xl"
                  >
                    <GlassAccountCard account={a} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
        {activeSorted.length > 1 && (
          <p className="mt-2 text-center text-[10px] text-neutral-600 sm:hidden">
            Glisser horizontalement pour plus de cartes
          </p>
        )}
      </div>
    </section>
  );
}
