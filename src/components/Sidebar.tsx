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
  ChevronLeft,
  LogOut,
} from "lucide-react";

const tabs = [
  { href: "/dashboard", label: "Accueil", Icon: LayoutDashboard },
  { href: "/expenses", label: "Dépenses", Icon: Receipt },
  { href: "/calendar", label: "Calendrier", Icon: CalendarDays },
  { href: "/budget", label: "Budget", Icon: PieChart },
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

export default function Sidebar({ dailyBudget, user, onLogout }: { dailyBudget: number; user: AuthUser; onLogout: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const navContent = (
    <>
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} mb-4`}>
        <Link href="/dashboard" className="flex items-center gap-2">
          <img src="/api/logo" alt="Yenni" className={collapsed ? "w-9 h-9" : "w-8 h-8"} />
          {!collapsed && (
            <span className="font-mono text-base font-bold bg-gradient-to-r from-emerald-400 to-emerald-400 bg-clip-text text-transparent">
              Yenni
            </span>
          )}
        </Link>
      </div>

      <nav className="flex flex-col gap-0.5 flex-1">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`relative flex items-center ${collapsed ? "justify-center px-2" : "gap-3 px-3"} py-2.5 rounded-xl text-[13px] font-medium transition-all border border-transparent
                ${active
                  ? "bg-gradient-to-r from-emerald-500/20 to-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-300"
                }`}
            >
              {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-gradient-to-b from-emerald-500 to-emerald-500" />
              )}
              <Icon size={18} className="shrink-0" />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      <div className={`mt-auto pt-3 ${collapsed ? "px-0" : "px-1"} space-y-2`}>
        <div className={`glass rounded-xl ${collapsed ? "p-2" : "p-3"} text-center`}>
          {collapsed ? (
            <div className="font-mono text-sm font-bold text-emerald-400">{formatCFA(dailyBudget)}</div>
          ) : (
            <>
              <div className="text-[10px] text-slate-500 mb-0.5">Budget / jour</div>
              <div className="font-mono text-lg font-bold text-emerald-400">{formatCFA(dailyBudget)}</div>
              <div className="text-[9px] text-slate-500">FCFA</div>
            </>
          )}
        </div>

        <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2.5 px-1"} py-2`}>
          <Avatar avatarPath={user.avatar_path} firstName={user.first_name} lastName={user.last_name} size="sm" className="ring-1" />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-slate-300 truncate">{user.first_name} {user.last_name}</div>
              <div className="text-[9px] text-slate-500 truncate">{user.email}</div>
            </div>
          )}
          <button onClick={onLogout}
            title="Déconnexion"
            className={`${collapsed ? "hidden" : ""} p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0`}>
            <LogOut size={14} />
          </button>
        </div>
        {collapsed && (
          <button onClick={onLogout} title="Déconnexion"
            className="w-full flex justify-center py-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut size={14} />
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex glass flex-col p-3 gap-1 border-r border-white/5 shrink-0 transition-all duration-300 relative ${
        collapsed ? "w-[68px]" : "w-56"
      }`}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full glass border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft size={14} className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
        </button>
        {navContent}
      </aside>

    </>
  );
}
