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
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-primary)]/95 backdrop-blur-xl border-t border-white/10 safe-bottom">
        <div className="flex items-center justify-around h-16 min-h-[64px] px-2">
          {mainTabs.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] px-3 py-2 rounded-xl transition-colors touch-manipulation ${
                  active ? "text-emerald-400" : "text-slate-400 active:text-emerald-400"
                }`}
                aria-label={label}
              >
                <Icon size={22} className="shrink-0" strokeWidth={active ? 2.5 : 2} />
                <span className="text-[10px] font-medium mt-0.5 truncate max-w-[64px]">{label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] px-3 py-2 rounded-xl transition-colors touch-manipulation ${
              isMoreActive ? "text-emerald-400" : "text-slate-400 active:text-emerald-400"
            }`}
            aria-label="Plus"
          >
            <MoreHorizontal size={22} className="shrink-0" strokeWidth={isMoreActive ? 2.5 : 2} />
            <span className="text-[10px] font-medium mt-0.5">Plus</span>
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
          <div className="lg:hidden fixed inset-x-0 bottom-0 top-[20%] z-50 bg-[var(--bg-surface)] rounded-t-2xl border-t border-white/10 flex flex-col animate-[slideUp_0.3s_ease_forwards] safe-bottom">
            <div className="flex items-center justify-between p-4 border-b border-white/5 shrink-0">
              <h3 className="text-base font-semibold text-slate-200">Menu</h3>
              <button
                onClick={() => setMoreOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 active:text-white touch-manipulation"
                aria-label="Fermer"
              >
                <X size={22} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {moreTabs.map(({ href, label, Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 min-h-[48px] px-4 rounded-xl transition-colors touch-manipulation ${
                      active ? "bg-emerald-500/20 text-emerald-300" : "text-slate-300 active:bg-white/5"
                    }`}
                  >
                    <Icon size={20} className="shrink-0" />
                    <span className="font-medium">{label}</span>
                  </Link>
                );
              })}
              <div className="glass rounded-xl p-4 mt-4">
                <div className="text-[10px] text-slate-500 mb-0.5">Budget / jour</div>
                <div className="font-mono text-lg font-bold text-emerald-400">{formatCFA(dailyBudget)} FCFA</div>
              </div>
              <div className="flex items-center gap-3 min-h-[48px] px-4 mt-2">
                <Avatar avatarPath={user.avatar_path} firstName={user.first_name} lastName={user.last_name} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-200 truncate">{user.first_name} {user.last_name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
                </div>
              </div>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  onLogout();
                }}
                className="flex items-center gap-3 w-full min-h-[48px] px-4 rounded-xl text-red-400 hover:bg-red-500/10 active:bg-red-500/15 transition-colors touch-manipulation mt-2"
              >
                <LogOut size={20} className="shrink-0" />
                <span className="font-medium">Déconnexion</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
