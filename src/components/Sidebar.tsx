"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatCFA } from "@/lib/constants";
import {
  LayoutDashboard,
  Receipt,
  CalendarDays,
  PieChart,
  Landmark,
  FolderKanban,
  HandCoins,
  Settings,
  Gem,
  History,
  Menu,
  X,
  ChevronLeft,
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

export default function Sidebar({ dailyBudget }: { dailyBudget: number }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const navContent = (isMobile: boolean) => (
    <>
      <div className={`flex items-center ${collapsed && !isMobile ? "justify-center" : "justify-between"} mb-4`}>
        <Link href="/dashboard" className={`flex items-center gap-2 ${collapsed && !isMobile ? "" : ""}`} onClick={() => isMobile && setMobileOpen(false)}>
          <Gem size={collapsed && !isMobile ? 28 : 24} className="text-violet-400 shrink-0" />
          {(!collapsed || isMobile) && (
            <span className="font-mono text-base font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              MonBudget
            </span>
          )}
        </Link>
        {isMobile && (
          <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400">
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-0.5 flex-1">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => isMobile && setMobileOpen(false)}
              title={collapsed && !isMobile ? label : undefined}
              className={`relative flex items-center ${collapsed && !isMobile ? "justify-center px-2" : "gap-3 px-3"} py-2.5 rounded-xl text-[13px] font-medium transition-all border border-transparent
                ${active
                  ? "bg-gradient-to-r from-indigo-500/20 to-violet-500/15 border-indigo-500/40 text-indigo-300"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-300"
                }`}
            >
              {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-gradient-to-b from-indigo-500 to-violet-500" />
              )}
              <Icon size={18} className="shrink-0" />
              {(!collapsed || isMobile) && label}
            </Link>
          );
        })}
      </nav>

      <div className={`mt-auto pt-3 ${collapsed && !isMobile ? "px-0" : "px-1"}`}>
        <div className={`glass rounded-xl ${collapsed && !isMobile ? "p-2" : "p-3"} text-center`}>
          {collapsed && !isMobile ? (
            <div className="font-mono text-sm font-bold text-emerald-400">{formatCFA(dailyBudget)}</div>
          ) : (
            <>
              <div className="text-[10px] text-slate-500 mb-0.5">Budget / jour</div>
              <div className="font-mono text-lg font-bold text-emerald-400">{formatCFA(dailyBudget)}</div>
              <div className="text-[9px] text-slate-500">FCFA</div>
            </>
          )}
        </div>
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
        {navContent(false)}
      </aside>

      {/* Mobile: bouton hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 rounded-xl glass border border-white/10 flex items-center justify-center text-slate-300 active:text-indigo-400 transition-colors"
        aria-label="Menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile: overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile: sidebar coulissante */}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-50 w-64 glass border-r border-white/10 flex flex-col p-4 transition-transform duration-300 ease-out safe-bottom ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {navContent(true)}
      </aside>
    </>
  );
}
