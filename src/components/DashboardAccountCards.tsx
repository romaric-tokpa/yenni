"use client";

import Link from "next/link";
import type { AccountWithBalance } from "@/lib/types";
import { formatCFA, accountTypeLabel } from "@/lib/constants";
import AccountGlyph from "./ui/AccountGlyph";
import { ChevronRight } from "lucide-react";

function GlassAccountCard({ account: a }: { account: AccountWithBalance }) {
  const accent = a.color || "#a1a1aa";
  const positive = a.balance >= 0;

  return (
    <article
      className={`
        group relative w-[min(100%,168px)] shrink-0 snap-center overflow-hidden rounded-xl
        sm:w-[188px]
        transition-all duration-300 ease-out
        will-change-transform
        hover:scale-[1.04] hover:-translate-y-1.5
        hover:shadow-[0_22px_48px_-14px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.12)_inset,0_1px_0_rgba(255,255,255,0.12)_inset]
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
        className="pointer-events-none absolute -left-1/4 -top-1/2 aspect-square w-[130%] rounded-full opacity-[0.11] blur-[52px] transition-all duration-500 ease-out group-hover:opacity-[0.2] group-hover:scale-110 group-hover:blur-[56px]"
        style={{ background: accent }}
      />
      <div
        className="pointer-events-none absolute -right-1/4 bottom-[-20%] aspect-square w-[75%] rounded-full opacity-[0.07] blur-[44px] transition-all duration-500 ease-out group-hover:opacity-[0.12] group-hover:scale-105"
        style={{ background: accent }}
      />

      {/* verre */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/[0.09] via-white/[0.025] to-transparent backdrop-blur-2xl transition-opacity duration-300 group-hover:from-white/[0.11]" />
      <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/[0.28] via-transparent to-white/[0.04]" />
      <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/[0.04] transition-[box-shadow,ring-color] duration-300 group-hover:ring-white/[0.12]" />

      <div className="relative z-10 flex h-full min-h-0 flex-col gap-1.5 overflow-hidden p-2.5 sm:gap-2 sm:p-3">
        {/* Ligne icône — hauteur fixe */}
        <div className="flex shrink-0 items-start justify-between gap-2">
          <div
            className={`
              flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg
              border border-white/[0.1] bg-white/[0.04] backdrop-blur-md
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

        {/* Nom + type : le type reste toujours visible (shrink-0), le nom peut se réduire */}
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

        {/* Solde : jamais réduit (shrink-0), toujours sous le texte */}
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

export default function DashboardAccountCards({ accounts }: { accounts: AccountWithBalance[] }) {
  const active = accounts.filter((a) => !a.is_archived);
  if (active.length === 0) return null;

  return (
    <section className="mb-7" aria-label="Comptes">
      <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
          Mes comptes
        </h2>
        <Link
          href="/settings/accounts"
          className="group inline-flex items-center gap-0.5 text-[11px] font-medium text-neutral-400 transition-colors hover:text-white"
        >
          Réglages
          <ChevronRight size={13} strokeWidth={2} className="opacity-60 transition-transform group-hover:translate-x-px" />
        </Link>
      </div>

      <div className="relative">
        <div
          className="-mx-0.5 flex items-center gap-3 overflow-x-auto px-0.5 py-1 snap-x snap-mandatory scroll-smooth [scrollbar-width:thin]"
          style={{ scrollbarColor: "rgba(255,255,255,0.12) transparent" }}
        >
          {active.map((a) => (
            <Link
              key={a.id}
              href={`/settings/accounts/${a.id}`}
              className="shrink-0 snap-center outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)] rounded-xl"
            >
              <GlassAccountCard account={a} />
            </Link>
          ))}
        </div>
        {active.length > 1 && (
          <p className="mt-2 text-center text-[10px] text-neutral-600 sm:hidden">Glisser pour plus de cartes</p>
        )}
      </div>

      <p className="mt-3 text-center text-[10px] leading-relaxed text-neutral-600 sm:text-left">
        Touche une carte pour voir les mouvements du compte. Soldes = opérations et transferts rattachés.
      </p>
    </section>
  );
}
