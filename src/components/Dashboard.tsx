"use client";
import { useState, useEffect, useMemo, type ComponentType } from "react";
import useSWR from "swr";
import { format, parseISO } from "date-fns";
import {
  formatCFA,
  MONTHS_FULL,
  getSelectableYears,
  getLinkedVaultEmergencyBalance,
  sumActiveAccountBalances,
  sumLiquideCashAndMobileMoney,
} from "@/lib/constants";
import {
  type TreasuryPeriodMode,
  todayIsoLocal,
  lastDayOfMonthIso,
  endOfYearIso,
  endOfQuarterIso,
  effectiveTreasuryThroughDate,
  isValidIsoDate,
} from "@/lib/dashboardTreasuryPeriod";
import Avatar from "./ui/Avatar";
import type { BudgetConfig, Category, FixedCharge, AccountWithBalance } from "@/lib/types";
import DashboardAccountCards from "./DashboardAccountCards";
import MonthlyBarChart from "./charts/MonthlyBarChart";
import BudgetPieChart from "./charts/BudgetPieChart";
import Icon from "./ui/Icon";
import AnimatedProgressBar from "./ui/AnimatedProgressBar";
import {
  TrendingUp, TrendingDown, Wallet, Trophy, Scale, Banknote,
  FolderOpen, PieChart, BarChart3, ClipboardList,
  CircleCheck, CircleAlert, CircleMinus, FileDown, ArrowRightLeft, ChevronLeft, ChevronRight, ChevronDown,
} from "lucide-react";
import { exportBilanPDFFromData } from "@/lib/exportUtils";
import Link from "next/link";
import { getModalHref } from "@/lib/modal";

const TREASURY_PILLS: { id: TreasuryPeriodMode; label: string; title: string }[] = [
  { id: "month", label: "Mois", title: "Trésorerie à la fin du mois sélectionné ci-dessous" },
  { id: "quarter", label: "Trimestre", title: "Trésorerie à la fin du trimestre (année du mois / année)" },
  { id: "year", label: "Année", title: "Trésorerie au 31/12 de l’année du sélecteur" },
  { id: "custom", label: "Dates", title: "Plage personnalisée — soldes à la date de fin" },
];

const filterPillClass = (active: boolean) =>
  `px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
    active
      ? "bg-emerald-500/30 text-emerald-300 ring-1 ring-emerald-500/50"
      : "bg-white/5 text-slate-400 hover:bg-white/10"
  }`;

/** Bouton chevron rond (navigation mois). */
const navRoundClass =
  "inline-flex items-center justify-center size-8 shrink-0 rounded-full border border-white/[0.08] bg-white/[0.05] text-slate-400 hover:bg-white/[0.09] hover:text-slate-200 disabled:opacity-30 transition-colors";

/** Sélecteur mois / année en pastille. */
const selectPillClass =
  "h-8 rounded-full border border-white/[0.08] bg-white/[0.05] pl-3 pr-7 text-[11px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/35 shrink-0 cursor-pointer";

interface AuthUser {
  first_name: string;
  last_name: string;
  avatar_path: string | null;
}

interface BudgetData {
  config: BudgetConfig;
  totalIncome: number;
  totalFixed: number;
  totalExpenses: number;
  soldeNet: number;
  /** Espèces + mobile money (soldes réels). */
  soldeDisponibleLiquide: number;
  resteAVivre: number;
  dailyBudget: number;
  daysLeftInMonth: number;
  totalSaved: number;
  totalProjectSaved: number;
  monthSalary: number;
  monthSaving: number;
  totalMonthSpent: number;
  totalBudgetVar: number;
  effectiveCategoryBudgets?: Record<string, number>;
  monthLoanPayments: number;
  monthLoanRepayments: number;
  monthLoanRecovered: number;
  totalDebt: number;
  catSpending: Record<string, number>;
  selectedMonth: number;
  selectedYear: number;
  setSelectedMonth: (m: number) => void;
  setSelectedYear: (y: number) => void;
  accountsWithBalance?: AccountWithBalance[];
}

function StatusDot({ level }: { level: "good" | "warn" | "bad" }) {
  if (level === "good") return <CircleCheck size={14} className="text-green-500" />;
  if (level === "warn") return <CircleAlert size={14} className="text-amber-500" />;
  return <CircleMinus size={14} className="text-red-500" />;
}

const quickActionClass =
  "group relative flex flex-1 items-center gap-0 py-2.5 px-3 sm:px-4 transition-[background-color] duration-200 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:bg-white/[0.05] border-b sm:border-b-0 sm:border-r border-white/[0.06] last:border-b-0 sm:last:border-r-0 active:bg-white/[0.03]";

function QuickActionLink({
  href,
  label,
  ariaLabel,
  icon: IconEl,
}: {
  href: string;
  label: string;
  ariaLabel: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string; "aria-hidden"?: boolean }>;
}) {
  return (
    <Link href={href} prefetch={false} className={quickActionClass} title={ariaLabel} aria-label={ariaLabel}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:justify-center">
        <IconEl
          size={15}
          strokeWidth={1.5}
          className="shrink-0 text-neutral-500 transition-colors group-hover:text-neutral-300"
          aria-hidden
        />
        <span className="truncate text-left text-[12.5px] font-medium leading-none tracking-tight text-neutral-400 transition-colors group-hover:text-neutral-200 sm:text-center">
          {label}
        </span>
      </div>
      <ChevronRight
        size={13}
        strokeWidth={1.5}
        className="shrink-0 text-neutral-600 opacity-60 transition-opacity group-hover:opacity-90 sm:hidden"
        aria-hidden
      />
    </Link>
  );
}

export default function Dashboard({ budget, user }: { budget: BudgetData; user?: AuthUser | null }) {
  const {
    config,
    totalIncome,
    totalFixed,
    totalExpenses,
    soldeNet,
    soldeDisponibleLiquide,
    resteAVivre,
    dailyBudget,
    daysLeftInMonth,
    totalSaved,
    totalProjectSaved,
    monthSalary,
    monthSaving,
    totalMonthSpent,
    totalBudgetVar,
    effectiveCategoryBudgets = {},
    monthLoanPayments,
    monthLoanRepayments,
    monthLoanRecovered,
    totalDebt,
    catSpending,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    accountsWithBalance = [],
  } = budget;

  const [exportingPdf, setExportingPdf] = useState(false);
  const [monthlyChartData, setMonthlyChartData] = useState<Array<{ month: number; Revenus: number; Dépenses: number }> | null>(null);
  const [budgetCategoriesOpen, setBudgetCategoriesOpen] = useState(true);

  /** Période d’affichage des soldes (trésorerie / « actifs »). */
  const [treasuryMode, setTreasuryMode] = useState<TreasuryPeriodMode>("month");
  const [treasuryQuarter, setTreasuryQuarter] = useState(() => Math.floor(new Date().getMonth() / 3));
  const [customFrom, setCustomFrom] = useState(() => format(new Date(new Date().getFullYear(), 0, 1), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState(() => todayIsoLocal());

  const periodEndIso = useMemo(() => {
    switch (treasuryMode) {
      case "month":
        return lastDayOfMonthIso(selectedYear, selectedMonth);
      case "quarter":
        return endOfQuarterIso(selectedYear, treasuryQuarter);
      case "year":
        return endOfYearIso(selectedYear);
      case "custom": {
        const a = isValidIsoDate(customFrom) ? customFrom : todayIsoLocal();
        const b = isValidIsoDate(customTo) ? customTo : todayIsoLocal();
        return a <= b ? b : a;
      }
      default:
        return lastDayOfMonthIso(selectedYear, selectedMonth);
    }
  }, [treasuryMode, selectedYear, selectedMonth, treasuryQuarter, customFrom, customTo]);

  const effectiveThrough = useMemo(
    () => effectiveTreasuryThroughDate(periodEndIso),
    [periodEndIso],
  );

  const fetchAccountsAsOf = (url: string) =>
    fetch(url).then((r) => {
      if (!r.ok) throw new Error("accounts");
      return r.json() as Promise<AccountWithBalance[]>;
    });

  const treasurySwrKey = `/api/accounts?through=${encodeURIComponent(effectiveThrough)}`;
  const {
    data: treasuryAccountsRaw,
    error: treasuryError,
    isLoading: treasuryLoading,
    isValidating: treasuryValidating,
  } = useSWR<AccountWithBalance[]>(treasurySwrKey, fetchAccountsAsOf);

  const treasuryAccounts = Array.isArray(treasuryAccountsRaw) ? treasuryAccountsRaw : null;
  const showTreasuryLoading =
    treasuryAccounts == null && !treasuryError && (treasuryLoading || treasuryValidating);

  const displayTreasuryAccounts = treasuryAccounts ?? accountsWithBalance;
  const totalActifsForPeriod = sumActiveAccountBalances(displayTreasuryAccounts);
  const soldeLiquideForPeriod = sumLiquideCashAndMobileMoney(displayTreasuryAccounts);

  const treasurySubLabel = useMemo(() => {
    try {
      const d = format(parseISO(effectiveThrough), "dd/MM/yyyy");
      if (effectiveThrough !== periodEndIso) {
        return `Soldes au ${d} (cible ${format(parseISO(periodEndIso), "dd/MM/yyyy")})`;
      }
      return `Soldes au ${d}`;
    } catch {
      return null;
    }
  }, [effectiveThrough, periodEndIso]);

  const setTreasuryModeAndSync = (mode: TreasuryPeriodMode) => {
    setTreasuryMode(mode);
    if (mode === "quarter") setTreasuryQuarter(Math.floor(selectedMonth / 3));
  };

  const selectableYearsArr = useMemo(() => getSelectableYears(), []);
  const yMin = selectableYearsArr[0];
  const yMax = selectableYearsArr[selectableYearsArr.length - 1];
  const canPrevMonth = selectedYear > yMin || selectedMonth > 0;
  const canNextMonth = selectedYear < yMax || selectedMonth < 11;
  const goPrevMonth = () => {
    if (selectedMonth > 0) setSelectedMonth(selectedMonth - 1);
    else if (selectedYear > yMin) {
      setSelectedYear(selectedYear - 1);
      setSelectedMonth(11);
    }
  };
  const goNextMonth = () => {
    if (selectedMonth < 11) setSelectedMonth(selectedMonth + 1);
    else if (selectedYear < yMax) {
      setSelectedYear(selectedYear + 1);
      setSelectedMonth(0);
    }
  };

  useEffect(() => {
    fetch(`/api/budget-summary?year=${selectedYear}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setMonthlyChartData(Array.isArray(d) && d.length === 12 ? d : null))
      .catch(() => setMonthlyChartData(null));
  }, [selectedYear]);

  const chargesRate = totalIncome > 0 ? (totalFixed / totalIncome) * 100 : 0;
  const realMonthlySavings = monthSaving + totalProjectSaved;
  const savingsRate = totalIncome > 0 ? (realMonthlySavings / totalIncome) * 100 : 0;
  const debtRatio = totalIncome > 0 ? (monthLoanRepayments / totalIncome) * 100 : 0;

  const vaultEmergencyBalance = getLinkedVaultEmergencyBalance(config, accountsWithBalance);
  const savingsGoalProgressAmount =
    vaultEmergencyBalance != null ? vaultEmergencyBalance : totalSaved;

  const handleExportPDF = async () => {
    setExportingPdf(true);
    try {
      await exportBilanPDFFromData({
        month: selectedMonth,
        year: selectedYear,
        totalIncome,
        totalFixed,
        totalMonthSpent,
        monthSaving,
        monthLoanRepayments,
        totalExpenses,
        soldeNet,
        dailyBudget,
        totalSaved,
        totalProjectSaved,
        catSpending,
        categories: config.categories,
        effectiveBudgets: effectiveCategoryBudgets,
        totalActifsKpi: totalActifsForPeriod,
        soldeDisponibleLiquide: soldeLiquideForPeriod,
        totalTreasuryBalances: totalActifsForPeriod,
      });
    } catch {
      // silent fail
    }
    setExportingPdf(false);
  };

  const actifsKpiSub = treasuryError
    ? "Impossible de charger les soldes à date — montant des comptes en cache (indicatif)."
    : showTreasuryLoading
      ? "Chargement des soldes à la date choisie…"
      : effectiveThrough === todayIsoLocal()
        ? "Trésorerie à la date du jour · comptes non archivés."
        : `Trésorerie au ${format(parseISO(effectiveThrough), "dd/MM/yyyy")} · comptes non archivés.`;

  const kpis = [
    {
      label: "Actifs",
      value: showTreasuryLoading ? "—" : formatCFA(totalActifsForPeriod),
      sub: actifsKpiSub,
      color: "text-green-500",
      shadow: "",
      IconComp: TrendingUp,
      iconColor: "text-green-500",
    },
    {
      label: "Passifs (Sorties)",
      value: formatCFA(totalExpenses),
      sub: `Fixes ${formatCFA(totalFixed)} + Dép. ${formatCFA(totalMonthSpent)}${monthLoanRepayments > 0 ? ` + Remb. ${formatCFA(monthLoanRepayments)}` : ""} + Ép. ${formatCFA(monthSaving)}`,
      color: "text-red-500",
      shadow: "",
      IconComp: TrendingDown,
      iconColor: "text-red-500",
    },
    {
      label: "Solde disponible",
      value: showTreasuryLoading ? "—" : formatCFA(Math.abs(soldeLiquideForPeriod)),
      sub:
        soldeLiquideForPeriod >= 0
          ? `Espèces + Mobile Money (à date) · ${formatCFA(dailyBudget)} / jour · ${daysLeftInMonth} jour${daysLeftInMonth > 1 ? "s" : ""} restant${daysLeftInMonth > 1 ? "s" : ""}`
          : "Espèces + Mobile Money (à date)",
      color: soldeLiquideForPeriod >= 0 ? "text-green-500" : "text-red-500",
      shadow: "",
      IconComp: soldeLiquideForPeriod >= 0 ? Wallet : Scale,
      iconColor: soldeLiquideForPeriod >= 0 ? "text-green-500" : "text-red-500",
      prefix: soldeLiquideForPeriod < 0 ? "-" : "",
    },
    {
      label: "Épargne Cumulée",
      value: formatCFA(totalSaved),
      sub: `${config.savingsGoal > 0 ? ((savingsGoalProgressAmount / config.savingsGoal) * 100).toFixed(1) : 0}% objectif fonds d’urgence${vaultEmergencyBalance != null ? " (coffre)" : ""}${totalProjectSaved > 0 ? ` · Projets ${formatCFA(totalProjectSaved)}` : ""}`,
      color: "text-amber-500",
      shadow: "",
      IconComp: Trophy,
      iconColor: "text-amber-500",
    },
  ];

  const miniKpis = [
    {
      label: "Taux d'endettement",
      value: `${debtRatio.toFixed(1)}%`,
      level: (debtRatio < 33 ? "good" : debtRatio < 50 ? "warn" : "bad") as "good" | "warn" | "bad",
    },
    {
      label: "Taux d'épargne",
      value: `${savingsRate.toFixed(1)}%`,
      level: (savingsRate >= 20 ? "good" : savingsRate >= 10 ? "warn" : "bad") as "good" | "warn" | "bad",
    },
    {
      label: "Dépensé ce mois",
      value: `${formatCFA(totalMonthSpent)} FCFA`,
      valueClass: "text-red-400",
      level: (totalMonthSpent <= totalBudgetVar ? "good" : "bad") as "good" | "bad",
    },
    {
      label: "Solde net (mois)",
      value: `${soldeNet >= 0 ? "+" : "-"}${formatCFA(Math.abs(soldeNet))}`,
      level: (soldeNet > 0 ? "good" : soldeNet === 0 ? "warn" : "bad") as "good" | "warn" | "bad",
    },
    {
      label: "Dette restante",
      value: `${formatCFA(totalDebt)} FCFA`,
      level: (totalDebt === 0 ? "good" : totalDebt < 1000000 ? "warn" : "bad") as "good" | "warn" | "bad",
    },
  ];

  const greeting = user ? `Bonjour, ${user.first_name}` : "Tableau de bord";

  return (
    <div className="animate-slide-up">
      {/* En-tête : salut à gauche, pastilles mois / année / PDF à droite (même niveau) */}
      <div className="mb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {user && (
              <Avatar
                avatarPath={user.avatar_path}
                firstName={user.first_name}
                lastName={user.last_name}
                size="md"
                className="shrink-0"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">{greeting}</h1>
              <p className="text-slate-500 text-[11px] mt-0.5 line-clamp-1">
                Budget : {MONTHS_FULL[selectedMonth]} {selectedYear}
              </p>
            </div>
          </div>

          <div
            className="flex flex-wrap items-center gap-1.5 sm:justify-end"
            role="group"
            aria-label="Mois budgétaire et export PDF"
          >
            <button
              type="button"
              onClick={goPrevMonth}
              disabled={!canPrevMonth}
              className={navRoundClass}
              aria-label="Mois précédent"
            >
              <ChevronLeft size={17} />
            </button>
            <select
              className={`${selectPillClass} min-w-[6.5rem] max-w-[10rem] sm:max-w-[11rem]`}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              aria-label="Mois budgétaire"
            >
              {MONTHS_FULL.map((m, i) => (
                <option key={i} value={i}>
                  {m}
                </option>
              ))}
            </select>
            <select
              className={`${selectPillClass} w-[5.25rem] sm:w-[5.75rem] min-w-[5.25rem]`}
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              aria-label="Année"
            >
              {selectableYearsArr.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={goNextMonth}
              disabled={!canNextMonth}
              className={navRoundClass}
              aria-label="Mois suivant"
            >
              <ChevronRight size={17} />
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={exportingPdf}
              className="inline-flex items-center justify-center gap-1 rounded-full px-3.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[11px] font-semibold border border-emerald-500/25 transition-colors shrink-0 disabled:opacity-50"
              title="Export PDF du bilan"
            >
              <FileDown size={13} />
              {exportingPdf ? "…" : "PDF"}
            </button>
          </div>
        </div>

        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mt-3 mb-1.5">
          Actifs (trésorerie à date)
        </p>
        <div className="flex flex-wrap gap-1.5 mb-2" role="tablist" aria-label="Période pour les soldes">
          {TREASURY_PILLS.map(({ id, label, title }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={treasuryMode === id}
              title={title}
              onClick={() => setTreasuryModeAndSync(id)}
              className={filterPillClass(treasuryMode === id)}
            >
              {label}
            </button>
          ))}
        </div>

        {treasuryMode === "quarter" && (
          <div className="flex flex-wrap gap-1.5 mb-2" aria-label="Trimestre">
            {[0, 1, 2, 3].map((q) => (
              <button
                key={q}
                type="button"
                title={`Trimestre ${q + 1} · ${selectedYear}`}
                onClick={() => setTreasuryQuarter(q)}
                className={filterPillClass(treasuryQuarter === q)}
              >
                T{q + 1}
              </button>
            ))}
          </div>
        )}

        {treasuryMode === "custom" && (
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <input
              id="treasury-from"
              type="date"
              className="input-field text-[11px] py-1 h-8 max-w-[9.75rem]"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              aria-label="Date de début"
            />
            <span className="text-slate-600 text-xs" aria-hidden>
              →
            </span>
            <input
              id="treasury-to"
              type="date"
              className="input-field text-[11px] py-1 h-8 max-w-[9.75rem]"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              title="Soldes à cette date (max. aujourd’hui)"
              aria-label="Date de fin (soldes à cette date)"
            />
          </div>
        )}
      </div>

      {/* Actions rapides — barre segmentée */}
      <div className="mb-6">
        <p className="mb-1.5 px-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600">
          Opérations
        </p>
        <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-neutral-950/30">
          <div className="flex flex-col sm:flex-row">
            <QuickActionLink
              href={getModalHref({ type: "new-expense", returnTo: "/dashboard" })}
              label="Dépense"
              ariaLabel="Enregistrer une dépense"
              icon={TrendingDown}
            />
            <QuickActionLink
              href={getModalHref({ type: "new-income", returnTo: "/dashboard" })}
              label="Revenu"
              ariaLabel="Ajouter un revenu"
              icon={TrendingUp}
            />
            <QuickActionLink
              href={getModalHref({ type: "quick-transfer", returnTo: "/dashboard" })}
              label="Transfert"
              ariaLabel="Transfert entre comptes"
              icon={ArrowRightLeft}
            />
          </div>
        </div>
      </div>

      {/* Salaire — vert charte, sobre, sans dégradé */}
      <div
        className={`mb-6 rounded-2xl border px-5 py-5 transition-colors duration-200 sm:px-6 sm:py-6 ${
          monthSalary > 0
            ? "border-emerald-500/25 bg-emerald-500/[0.07] hover:border-emerald-500/35"
            : "border-emerald-500/15 bg-emerald-500/[0.04] hover:border-emerald-500/25"
        }`}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                monthSalary > 0
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-500/55"
              }`}
            >
              <Banknote size={22} strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-500/80">
                Revenu principal
              </p>
              <h2 className="mt-1 text-base font-semibold tracking-tight text-neutral-100 sm:text-lg">
                {monthSalary > 0 ? "Salaire du mois" : "Salaire à renseigner"}
              </h2>
              <p className="mt-2 max-w-md text-xs leading-relaxed text-neutral-500">
                {monthSalary > 0
                  ? `Montant net pour ${MONTHS_FULL[selectedMonth]} ${selectedYear}.`
                  : "Renseigne ton salaire dans Réglages : il pilote budget, indicateurs et reste à vivre."}
              </p>
            </div>
          </div>

          <div
            className={`w-full rounded-xl border px-4 py-4 sm:max-w-[15rem] sm:text-right ${
              monthSalary > 0
                ? "border-emerald-500/25 bg-[var(--bg-surface)] text-[var(--accent)]"
                : "border-emerald-500/15 bg-[var(--bg-surface)] text-neutral-500"
            }`}
            aria-label={monthSalary > 0 ? `Salaire : ${formatCFA(monthSalary)}` : "Salaire non renseigné"}
          >
            <span className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Net FCFA</span>
            <span className="mt-1 block font-mono text-lg font-bold tabular-nums tracking-tight sm:text-xl">
              {monthSalary > 0 ? formatCFA(monthSalary) : "—"}
            </span>
          </div>
        </div>
      </div>

      <DashboardAccountCards accounts={displayTreasuryAccounts} treasurySubLabel={treasurySubLabel} />

      {/* KPIs principaux */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <div key={i} className="flex items-start gap-3">
            <k.IconComp size={20} className={`shrink-0 mt-0.5 ${k.iconColor}`} />
            <div className="min-w-0">
              <div className="text-[10px] text-neutral-500">{k.label}</div>
              <div className={`font-mono text-base lg:text-lg font-bold mt-0.5 ${k.color}`}>{k.prefix ?? ""}{k.value}</div>
              <div className="text-[10px] text-neutral-500 mt-0.5 line-clamp-2">{k.sub}</div>
            </div>
          </div>
        ))}
        </div>
      </div>

      {/* Mini KPIs */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {miniKpis.map((k, i) => (
          <div key={i} className="flex justify-between items-center py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="min-w-0">
              <div className="text-[10px] text-neutral-500 truncate">{k.label}</div>
              <div
                className={`font-mono text-xs font-semibold mt-0.5 truncate ${"valueClass" in k && k.valueClass ? k.valueClass : ""}`}
              >
                {k.value}
              </div>
            </div>
            <StatusDot level={k.level} />
          </div>
        ))}
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-emerald-500/12 bg-emerald-500/[0.03] p-5 sm:p-6">
        <button
          type="button"
          id="budget-categories-toggle"
          aria-expanded={budgetCategoriesOpen}
          aria-controls="budget-categories-panel"
          onClick={() => setBudgetCategoriesOpen((open) => !open)}
          className="flex w-full items-start gap-3 rounded-xl text-left transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)] -m-2 p-2 sm:-m-1 sm:p-1"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
            <FolderOpen size={20} className="text-emerald-400" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold tracking-tight text-neutral-100">Budget par catégorie</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Dépenses du mois par rapport au plafond défini ({MONTHS_FULL[selectedMonth]} {selectedYear})
            </p>
            <p className="mt-1 text-[11px] text-neutral-600">
              {budgetCategoriesOpen ? "Cliquer pour replier la liste" : `Cliquer pour afficher les ${config.categories.length} catégories`}
            </p>
          </div>
          <ChevronDown
            size={22}
            strokeWidth={2}
            className={`mt-0.5 shrink-0 text-emerald-400/85 transition-transform duration-200 ${budgetCategoriesOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {budgetCategoriesOpen && (
        <div
          id="budget-categories-panel"
          role="region"
          aria-labelledby="budget-categories-toggle"
          className="mt-5 flex flex-col gap-3 border-t border-emerald-500/10 pt-5"
        >
          {config.categories.map((cat: Category) => {
            const budget = effectiveCategoryBudgets[cat.id] ?? cat.budget;
            const spent = catSpending[cat.id] || 0;
            const pct = budget > 0 ? Math.min((spent / budget) * 100, 150) : 0;
            const isOver = budget > 0 && spent > budget;
            const barColor = isOver ? "#ef4444" : pct > 80 ? "#f59e0b" : cat.color;
            return (
              <div
                key={cat.id}
                className="rounded-xl border border-white/6 bg-[var(--bg-surface)]/80 p-3.5 transition-colors hover:border-white/10 sm:p-4"
              >
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/8"
                      style={{ backgroundColor: `${cat.color}18`, borderColor: `${cat.color}33` }}
                    >
                      <Icon name={cat.icon} size={15} style={{ color: cat.color }} />
                    </span>
                    <span className="truncate text-[13px] font-medium text-neutral-200">{cat.label}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className={`font-mono text-[11px] sm:text-xs tabular-nums ${isOver ? "text-red-400" : "text-neutral-400"}`}>
                      <span className="text-neutral-500">consommé</span>{" "}
                      <span className="font-semibold text-neutral-300">{formatCFA(spent)}</span>
                      <span className="text-neutral-600"> · </span>
                      <span className="text-neutral-500">budget</span>{" "}
                      <span className="text-neutral-400">{formatCFA(budget)}</span>
                    </span>
                    <StatusDot level={isOver ? "bad" : pct > 80 ? "warn" : "good"} />
                  </div>
                </div>
                <AnimatedProgressBar
                  value={budget > 0 ? spent : 0}
                  max={budget > 0 ? budget : 1}
                  duration={0.6}
                  className="h-2 !bg-white/[0.06]"
                  gradient={`linear-gradient(90deg, ${barColor} 0%, ${barColor} 100%)`}
                />
                {budget > 0 && (
                  <p className="mt-2 text-right font-mono text-[10px] text-neutral-600">
                    {Math.round(Math.min(pct, 999))}% du budget
                  </p>
                )}
              </div>
            );
          })}
        </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <h3 className="text-xs font-semibold mb-2 text-neutral-400 flex items-center gap-1.5">
            <PieChart size={12} className="text-emerald-400" /> Répartition du budget
          </h3>
          <BudgetPieChart categories={config.categories} effectiveBudgets={effectiveCategoryBudgets} />
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <h3 className="text-xs font-semibold mb-2 text-neutral-400 flex items-center gap-1.5">
            <BarChart3 size={12} className="text-emerald-400" /> Revenus vs Dépenses
          </h3>
          <MonthlyBarChart
            monthlyData={monthlyChartData ?? undefined}
            totalIncome={totalIncome}
            totalFixed={totalFixed}
            totalVariable={totalMonthSpent}
            currentMonth={selectedMonth}
          />
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <ClipboardList size={14} className="text-emerald-400" /> Charges fixes
        </h3>
        {config.fixedCharges.length === 0 ? (
          <p className="text-neutral-500 text-xs py-4">Aucune charge fixe configurée</p>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-2.5">
          {config.fixedCharges.map((ch: FixedCharge) => (
            <div
              key={ch.id}
              className="flex justify-between items-center px-3 lg:px-4 py-2.5 lg:py-3 rounded-lg border border-white/5 bg-white/[0.02]"
            >
              <span className="text-xs lg:text-[13px] flex items-center gap-1.5">
                <Icon name={ch.icon} size={14} className="text-neutral-400" />
                {ch.label}
              </span>
              <span className="font-mono text-xs lg:text-[13px] text-red-300 font-semibold">
                {formatCFA(ch.amount)}
              </span>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
