"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gem, ArrowRight, Wallet, Settings, PiggyBank } from "lucide-react";
import { BudgetConfig } from "@/lib/types";
import { DEFAULT_CONFIG } from "@/lib/constants";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((config: BudgetConfig) => {
        const isConfigured = config.salary > 0 || config.fixedCharges.length > 0;
        if (isConfigured) {
          router.replace("/dashboard");
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 animate-pulse flex justify-center">
            <Gem size={48} className="text-violet-400" />
          </div>
          <div className="font-mono text-lg text-violet-400">MonBudget</div>
          <div className="text-sm text-slate-500 mt-2">Chargement...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-strong rounded-2xl p-6 sm:p-10 max-w-lg w-full text-center animate-slide-up">
        <div className="mb-5 flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center">
            <Gem size={32} className="text-violet-400" />
          </div>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold mb-2 bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
          Bienvenue sur MonBudget
        </h1>
        <p className="text-slate-400 text-sm mb-8">
          Configure ton budget pour commencer à suivre tes finances.
        </p>

        <div className="grid gap-3 mb-8 text-left">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Wallet size={18} className="text-emerald-400" />
            </div>
            <div>
              <div className="text-xs font-medium">Renseigne tes revenus</div>
              <div className="text-[10px] text-slate-500">Salaire, revenus complémentaires</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="w-9 h-9 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
              <Settings size={18} className="text-red-400" />
            </div>
            <div>
              <div className="text-xs font-medium">Ajoute tes charges fixes</div>
              <div className="text-[10px] text-slate-500">Loyer, abonnements, crédits</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
              <PiggyBank size={18} className="text-indigo-400" />
            </div>
            <div>
              <div className="text-xs font-medium">Définis tes budgets</div>
              <div className="text-[10px] text-slate-500">Par catégorie de dépenses</div>
            </div>
          </div>
        </div>

        <Link
          href="/settings"
          className="btn-primary w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
        >
          Configurer mon budget <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
