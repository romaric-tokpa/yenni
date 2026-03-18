"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatCFA } from "@/lib/constants";
import Avatar from "./ui/Avatar";
import {
  LayoutDashboard,
  Receipt,
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
} from "lucide-react";

const mainTabs = [
  { href: "/dashboard", label: "Accueil", Icon: LayoutDashboard },
  { href: "/expenses", label: "Dépenses", Icon: Receipt },
  { href: "/budget", label: "Budget", Icon: PieChart },
  { href: "/calendar", label: "Calendrier", Icon: CalendarDays },
];

const moreTabs = [
  { href: "/savings", label: "Épargne", Icon: Landmark },
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
  const isMoreActive = moreTabs.some((t) => pathname === t.href);

  return (
    <>
      {/* Bottom navigation — mobile & tablet (< lg) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-surface)] border-t border-white/5 safe-bottom">
        <div className="flex items-center justify-around h-14 px-1">
          {mainTabs.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center min-w-[52px] py-2 transition-colors touch-manipulation ${
                  active ? "text-green-500" : "text-neutral-500"
                }`}
                aria-label={label}
              >
                <Icon size={20} className="shrink-0" strokeWidth={2} />
                <span className="text-[9px] mt-0.5 truncate max-w-[56px]">{label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center min-w-[52px] py-2 transition-colors touch-manipulation ${
              isMoreActive ? "text-green-500" : "text-neutral-500"
            }`}
            aria-label="Plus"
          >
            <MoreHorizontal size={20} className="shrink-0" strokeWidth={2} />
            <span className="text-[9px] mt-0.5">Plus</span>
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
          <div className="lg:hidden fixed inset-x-0 bottom-0 top-[25%] z-50 popup-panel rounded-t-lg border-t border-white/10 flex flex-col safe-bottom">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
              <h3 className="text-sm font-medium text-neutral-200">Menu</h3>
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
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-2.5 min-h-[44px] px-3 rounded-lg transition-colors ${
                      active ? "bg-white/8 text-green-500" : "text-neutral-300"
                    }`}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className="text-sm">{label}</span>
                  </Link>
                );
              })}
              <div className="rounded-lg bg-white/4 p-3 mt-3">
                <div className="text-[10px] text-neutral-500">Budget / jour</div>
                <div className="font-mono text-base font-semibold text-green-500">{formatCFA(dailyBudget)}</div>
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
