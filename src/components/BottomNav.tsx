"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatCFA } from "@/lib/constants";
import Avatar from "./ui/Avatar";
import {
  LayoutDashboard,
  ArrowRightLeft,
  CalendarDays,
  PieChart,
  Landmark,
  FolderKanban,
  HandCoins,
  Settings,
  History,
  MoreHorizontal,
  X,
  LogOut,
  Heart,
  ShoppingCart,
} from "lucide-react";

const mainTabs = [
  { href: "/dashboard", label: "Accueil", Icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", Icon: ArrowRightLeft },
  { href: "/budget", label: "Budget", Icon: PieChart },
  { href: "/calendar", label: "Calendrier", Icon: CalendarDays },
];

const moreTabs = [
  { href: "/savings", label: "Épargne", Icon: Landmark },
  { href: "/wishes", label: "Envies", Icon: Heart },
  { href: "/shopping-lists", label: "Courses", Icon: ShoppingCart },
  { href: "/loans", label: "Prêts", Icon: HandCoins },
  { href: "/projects", label: "Projets", Icon: FolderKanban },
  { href: "/history", label: "Historique", Icon: History },
  { href: "/settings", label: "Réglages", Icon: Settings },
];

interface AuthUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  avatar_path: string | null;
}

export default function BottomNav({
  dailyBudget,
  user,
  onLogout,
}: {
  dailyBudget: number;
  user: AuthUser;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (moreOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [moreOpen]);

  const isMainActive = mainTabs.some((t) => pathname === t.href);
  const isMoreActive = moreTabs.some(
    (t) => pathname === t.href || (t.href === "/settings" && pathname.startsWith("/settings")),
  );

  return (
    <>
      {/* Bottom navigation — mobile & tablet (< lg) */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-surface)]/95 backdrop-blur-lg border-t border-white/[0.08] safe-bottom shadow-[0_-8px_32px_rgba(0,0,0,0.35)]"
        aria-label="Navigation principale"
      >
        <div className="flex items-stretch justify-around min-h-[4.25rem] px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
          {mainTabs.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center min-w-[3.5rem] flex-1 max-w-[5.5rem] py-1.5 rounded-xl transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-inset ${
                  active
                    ? "text-emerald-400 bg-emerald-500/[0.08]"
                    : "text-neutral-500 active:text-neutral-300"
                }`}
                aria-label={label}
              >
                <Icon size={22} className="shrink-0" strokeWidth={2} aria-hidden />
                <span className="text-[10px] mt-1 font-medium truncate max-w-[4.5rem] text-center leading-tight">{label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center min-w-[3.5rem] flex-1 max-w-[5.5rem] py-1.5 rounded-xl transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-inset ${
              isMoreActive ? "text-emerald-400 bg-emerald-500/[0.08]" : "text-neutral-500 active:text-neutral-300"
            }`}
            aria-label="Plus d’options"
            aria-expanded={moreOpen}
          >
            <MoreHorizontal size={22} className="shrink-0" strokeWidth={2} aria-hidden />
            <span className="text-[10px] mt-1 font-medium">Plus</span>
          </button>
        </div>
      </nav>

      {/* Sheet "Plus" — plein écran sur mobile */}
      {moreOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div className="lg:hidden fixed inset-x-0 bottom-0 top-[22%] z-50 popup-panel rounded-t-2xl border-t border-white/10 flex flex-col safe-bottom shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-neutral-100">Autres sections</h3>
                <p className="text-[11px] text-neutral-500 mt-0.5">Accès rapide</p>
              </div>
              <button
                onClick={() => setMoreOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 active:text-white touch-manipulation"
                aria-label="Fermer"
              >
                <X size={22} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
              {moreTabs.map(({ href, label, Icon }) => {
                const active =
                  pathname === href || (href === "/settings" && pathname.startsWith("/settings"));
                return (
                  <Link
                    key={href}
                    href={href}
                    prefetch={false}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-2.5 min-h-[48px] px-3 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                      active
                        ? "bg-emerald-500/[0.1] text-emerald-400 border border-emerald-500/15"
                        : "text-neutral-300 active:bg-white/[0.04]"
                    }`}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className="text-sm">{label}</span>
                  </Link>
                );
              })}
              <div
                className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 mt-3"
                title="Basé sur le liquide espèces + Mobile Money ÷ jours restants du mois"
              >
                <div className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide">Budget / jour</div>
                <div className="font-mono text-base font-semibold text-emerald-400 tabular-nums mt-0.5">{formatCFA(dailyBudget)}</div>
              </div>
              <div className="flex items-center gap-2.5 px-3 py-2 mt-2">
                <Avatar avatarPath={user.avatar_path} firstName={user.first_name} lastName={user.last_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-neutral-200 truncate">{user.first_name}</div>
                  <div className="text-[10px] text-neutral-500 truncate">{user.email}</div>
                </div>
              </div>
              <button
                onClick={() => { setMoreOpen(false); onLogout(); }}
                className="flex items-center gap-2.5 w-full min-h-[44px] px-3 rounded-lg text-red-400 text-sm mt-1"
              >
                <LogOut size={18} className="shrink-0" />
                Déconnexion
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
