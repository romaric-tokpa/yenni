"use client";
import { useState } from "react";
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
  ChevronLeft,
  ChevronRight,
  LogOut,
  Heart,
  ShoppingCart,
} from "lucide-react";

const tabs = [
  { href: "/dashboard", label: "Accueil", Icon: LayoutDashboard },
  { href: "/expenses", label: "Dépenses", Icon: Receipt },
  { href: "/calendar", label: "Calendrier", Icon: CalendarDays },
  { href: "/budget", label: "Budget", Icon: PieChart },
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

export default function Sidebar({ dailyBudget, user, onLogout }: { dailyBudget: number; user: AuthUser; onLogout: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const navContent = (
    <>
      {/* Zone scrollable : logo + nav (le scroll ne s'applique qu'ici si besoin) */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2"} mb-5 shrink-0`}>
          <Link href="/dashboard" prefetch={false} className="flex items-center gap-2 min-w-0">
            <img src="/api/logo" alt="Yenni" className="w-9 h-9 shrink-0" />
            {!collapsed && (
              <span className="font-semibold text-emerald-400 truncate">Yenni</span>
            )}
          </Link>
        </div>

        <nav className="flex flex-col gap-1 shrink-0">
          {tabs.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                prefetch={false}
                title={collapsed ? label : undefined}
                className={`relative flex items-center ${collapsed ? "justify-center px-2" : "gap-3 px-3"} py-2.5 rounded-lg text-[13px] font-medium transition-all
                  ${active
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
                  }`}
              >
                {active && (
                  <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-emerald-500" />
                )}
                <Icon size={18} className="shrink-0" strokeWidth={2} />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer fixe : toujours visible en bas (budget/jour + user + déconnexion) */}
      <div className={`flex-shrink-0 pt-4 border-t border-white/5 ${collapsed ? "space-y-2" : "space-y-3"}`}>
        <div className={`rounded-lg border border-white/5 bg-white/[0.02] ${collapsed ? "p-2 text-center" : "p-3"}`}>
          {collapsed ? (
            <div className="font-mono text-xs font-bold text-emerald-400" title={`${formatCFA(dailyBudget)} / jour`}>
              {formatCFA(dailyBudget)}
            </div>
          ) : (
            <>
              <div className="text-[10px] text-neutral-500 mb-0.5">Budget / jour</div>
              <div className="font-mono text-base font-bold text-emerald-400">{formatCFA(dailyBudget)}</div>
            </>
          )}
        </div>

        <div className={`flex items-center ${collapsed ? "flex-col gap-1.5" : "gap-2.5"} py-2`}>
          <div className={`flex items-center ${collapsed ? "justify-center" : "flex-1 min-w-0"} gap-2.5`}>
            <Avatar avatarPath={user.avatar_path} firstName={user.first_name} lastName={user.last_name} size="sm" className="shrink-0 ring-1 ring-white/10" />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-neutral-300 truncate">{user.first_name} {user.last_name}</div>
                <div className="text-[9px] text-neutral-500 truncate">{user.email}</div>
              </div>
            )}
          </div>
          <button
            onClick={onLogout}
            title="Déconnexion"
            className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
          >
            <LogOut size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </>
  );

  const widthClass = collapsed ? "w-[52px]" : "w-52";

  return (
    <>
      {/* Spacer pour réserver la place dans le flux (évite que le main passe sous la sidebar) */}
      <div className={`hidden lg:block shrink-0 ${widthClass} transition-all duration-200`} aria-hidden />
      {/* Sidebar fixe : ne défile pas, footer toujours visible */}
      <aside
        className={`hidden lg:flex flex-col fixed top-0 left-0 h-screen p-3 transition-all duration-200 bg-[#171717] border-r border-white/5 z-30 ${widthClass}`}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full bg-[#171717] border border-white/10 flex items-center justify-center text-neutral-500 hover:text-white hover:border-white/20 shadow-lg transition-colors"
          title={collapsed ? "Agrandir" : "Réduire"}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
        {navContent}
      </aside>
    </>
  );
}
