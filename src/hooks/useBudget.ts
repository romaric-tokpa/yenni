"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";

/** Synchronisation des comptes entre onglets (même origine). */
const ACCOUNTS_BROADCAST_CHANNEL = "monbudget-accounts-sync-v1";
import { mutate } from "swr";
import { BudgetConfig, Expense, Income, Project, FixedChargePayment, Loan, LoanPayment, PlannedExpense, LoanScheduleRow, LoanScheduleInput, AccountWithBalance } from "@/lib/types";
import {
  DEFAULT_CONFIG,
  INCOME_SOURCE_SALARY_SETTINGS,
  sumActiveAccountBalances,
  sumLiquideCashAndMobileMoney,
} from "@/lib/constants";

/** Invalide le cache de l'historique pour forcer un rafraîchissement */
function invalidateHistoryCache() {
  mutate(
    (key) => typeof key === "string" && key.startsWith("/api/history"),
    undefined,
    { revalidate: true }
  );
}

/** Jours restants dans le mois (exercice comptable mois par mois) */
function getDaysLeftInMonth(month: number, year: number): number {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const lastDay = new Date(year, month + 1, 0).getDate();
  if (year < currentYear || (year === currentYear && month < currentMonth)) return 0;
  if (year > currentYear || (year === currentYear && month > currentMonth)) return lastDay;
  return Math.max(0, lastDay - now.getDate());
}

export function useBudget() {
  const [config, setConfig] = useState<BudgetConfig>(DEFAULT_CONFIG);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [fixedPayments, setFixedPayments] = useState<FixedChargePayment[]>([]);
  const [savings, setSavings] = useState<number[]>(Array(12).fill(0));
  const [totalSavedManualCumulative, setTotalSavedManualCumulative] = useState(0);
  const [savedInPeriod, setSavedInPeriod] = useState<number | null>(null);
  const [salaries, setSalaries] = useState<number[]>(Array(12).fill(0));
  /** Compte de versement du salaire par mois (0–11), année = selectedYear */
  const [salaryAccountIds, setSalaryAccountIds] = useState<(number | null)[]>(() => Array(12).fill(null));
  const [otherIncomes, setOtherIncomes] = useState<number[]>(Array(12).fill(0));
  const [projects, setProjects] = useState<Project[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanPayments, setLoanPayments] = useState<LoanPayment[]>([]);
  const [plannedExpenses, setPlannedExpenses] = useState<PlannedExpense[]>([]);
  /** Soldes tels que renvoyés par l’API (écritures par compte) */
  const [accountsFromApi, setAccountsFromApi] = useState<AccountWithBalance[]>([]);
  const [monthProjectFunds, setMonthProjectFunds] = useState(0);
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>({});
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  /** Incrémenté après chaque rechargement des comptes (sauf tout premier chargement) — pour réagir côté UI (ex. mouvements). */
  const [accountsRevision, setAccountsRevision] = useState(0);
  const accountsHydratedRef = useRef(false);
  const lastAccountsBroadcastTsRef = useRef(0);

  const fetchConfig = useCallback(async () => {
    try {
      const r = await fetch("/api/config");
      if (r.ok) setConfig(await r.json());
    } catch { /* ignore */ }
  }, []);

  const fetchExpenses = useCallback(async () => {
    try {
      const r = await fetch(
        `/api/expenses?month=${selectedMonth}&year=${selectedYear}`
      );
      if (r.ok) {
        const data = await r.json();
        setExpenses(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ }
  }, [selectedMonth, selectedYear]);

  const fetchIncomes = useCallback(async () => {
    try {
      const r = await fetch(
        `/api/incomes?month=${selectedMonth}&year=${selectedYear}`
      );
      if (r.ok) {
        const data = await r.json();
        setIncomes(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ }
  }, [selectedMonth, selectedYear]);

  const fetchFixedPayments = useCallback(async () => {
    try {
      const r = await fetch(
        `/api/fixed-charges?month=${selectedMonth}&year=${selectedYear}`
      );
      if (r.ok) {
        const data = await r.json();
        setFixedPayments(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ }
  }, [selectedMonth, selectedYear]);

  const fetchSavings = useCallback(async () => {
    try {
      const [rYear, rCumul] = await Promise.all([
        fetch(`/api/savings?year=${selectedYear}`),
        fetch(`/api/savings?cumulative=true`),
      ]);
      if (rYear.ok) setSavings(await rYear.json());
      if (rCumul.ok) setTotalSavedManualCumulative(await rCumul.json());
    } catch { /* ignore */ }
  }, [selectedYear]);

  const fetchSavedInPeriod = useCallback(async () => {
    const start = config.savingsGoalStartDate;
    const end = config.savingsGoalDeadline;
    if (!start || !end || start >= end) {
      setSavedInPeriod(null);
      return;
    }
    try {
      const r = await fetch(`/api/savings?startDate=${start}&endDate=${end}`);
      if (r.ok) setSavedInPeriod(await r.json());
      else setSavedInPeriod(0);
    } catch { setSavedInPeriod(0); }
  }, [config.savingsGoalStartDate, config.savingsGoalDeadline]);

  const fetchSalaries = useCallback(async () => {
    try {
      const r = await fetch(`/api/salaries?year=${selectedYear}`);
      if (!r.ok) return;
      const data = await r.json();
      if (data && Array.isArray(data.amounts) && Array.isArray(data.accountIds)) {
        const amounts = data.amounts.map((x: unknown) => Number(x) || 0);
        const ids = (data.accountIds as unknown[]).map((x) =>
          x == null || x === "" ? null : Number(x),
        ) as (number | null)[];
        while (amounts.length < 12) amounts.push(0);
        while (ids.length < 12) ids.push(null);
        setSalaries(amounts.slice(0, 12));
        setSalaryAccountIds(ids.slice(0, 12));
      } else if (Array.isArray(data)) {
        const arr = data.map((x: unknown) => Number(x) || 0);
        while (arr.length < 12) arr.push(0);
        setSalaries(arr.slice(0, 12));
        setSalaryAccountIds(Array(12).fill(null));
      }
    } catch {
      /* ignore */
    }
  }, [selectedYear]);

  const fetchOtherIncomes = useCallback(async () => {
    try {
      const r = await fetch(`/api/other-incomes?year=${selectedYear}`);
      if (r.ok) setOtherIncomes(await r.json());
    } catch { /* ignore */ }
  }, [selectedYear]);

  const fetchCategoryBudgets = useCallback(async () => {
    try {
      const r = await fetch(`/api/category-budgets?month=${selectedMonth}&year=${selectedYear}`);
      if (r.ok) setCategoryBudgets(await r.json());
      else setCategoryBudgets({});
    } catch { setCategoryBudgets({}); }
  }, [selectedMonth, selectedYear]);

  const fetchProjects = useCallback(async () => {
    try {
      const r = await fetch("/api/projects");
      if (r.ok) setProjects(await r.json());
    } catch { /* ignore */ }
  }, []);

  const fetchMonthProjectFunds = useCallback(async () => {
    try {
      const r = await fetch(`/api/project-funds-sum?month=${selectedMonth}&year=${selectedYear}`, { cache: "no-store" });
      if (r.ok) {
        const data = await r.json();
        setMonthProjectFunds(data.sum ?? 0);
      } else setMonthProjectFunds(0);
    } catch { setMonthProjectFunds(0); }
  }, [selectedMonth, selectedYear]);

  /** Mise à jour optimiste : ajoute un montant aux fonds projet du mois (après ajout réussi) */
  const addToMonthProjectFunds = useCallback((amount: number, fundDate: string) => {
    const [y, m] = fundDate.split("-").map(Number);
    if (m === selectedMonth + 1 && y === selectedYear) {
      setMonthProjectFunds((prev) => prev + amount);
    }
  }, [selectedMonth, selectedYear]);

  const fetchLoans = useCallback(async () => {
    try {
      const r = await fetch("/api/loans");
      if (r.ok) { const data = await r.json(); setLoans(Array.isArray(data) ? data : []); }
    } catch { /* ignore */ }
  }, []);

  const fetchLoanPayments = useCallback(async () => {
    try {
      const r = await fetch(`/api/loan-payments?month=${selectedMonth}&year=${selectedYear}`);
      if (r.ok) { const data = await r.json(); setLoanPayments(Array.isArray(data) ? data : []); }
    } catch { /* ignore */ }
  }, [selectedMonth, selectedYear]);

  const fetchPlannedExpenses = useCallback(async () => {
    try {
      const r = await fetch("/api/planned-expenses");
      if (r.ok) { const data = await r.json(); setPlannedExpenses(Array.isArray(data) ? data : []); }
    } catch { /* ignore */ }
  }, []);

  const fetchAccounts = useCallback(async (opts?: { fromBroadcast?: boolean }) => {
    try {
      const r = await fetch("/api/accounts");
      if (r.ok) {
        const data = await r.json();
        setAccountsFromApi(Array.isArray(data) ? data : []);
        if (accountsHydratedRef.current) {
          setAccountsRevision((v) => v + 1);
        } else {
          accountsHydratedRef.current = true;
        }
        if (!opts?.fromBroadcast && typeof BroadcastChannel !== "undefined") {
          try {
            const ts = Date.now();
            lastAccountsBroadcastTsRef.current = ts;
            const bc = new BroadcastChannel(ACCOUNTS_BROADCAST_CHANNEL);
            bc.postMessage({ type: "accounts-invalidate", ts });
            bc.close();
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  /** Autres onglets : recharger les comptes sans rebroadcaster (évite les boucles). */
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(ACCOUNTS_BROADCAST_CHANNEL);
    const handler = (ev: MessageEvent<{ type?: string; ts?: number }>) => {
      const d = ev.data;
      if (d?.type !== "accounts-invalidate") return;
      if (d.ts === lastAccountsBroadcastTsRef.current) return;
      void fetchAccounts({ fromBroadcast: true });
    };
    bc.addEventListener("message", handler);
    return () => {
      bc.removeEventListener("message", handler);
      bc.close();
    };
  }, [fetchAccounts]);

  /** Retour sur l’onglet / l’app : resynchroniser les soldes comptes. */
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        t = null;
        void fetchAccounts({ fromBroadcast: true });
      }, 350);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (t) clearTimeout(t);
    };
  }, [fetchAccounts]);

  useEffect(() => {
    Promise.all([
      fetchConfig(),
      fetchExpenses(),
      fetchIncomes(),
      fetchFixedPayments(),
      fetchSavings(),
      fetchSalaries(),
      fetchOtherIncomes(),
      fetchProjects(),
      fetchMonthProjectFunds(),
      fetchCategoryBudgets(),
      fetchLoans(),
      fetchLoanPayments(),
      fetchPlannedExpenses(),
      fetchAccounts(),
    ]).then(() => setLoading(false));
  }, [fetchConfig, fetchExpenses, fetchIncomes, fetchFixedPayments, fetchSavings, fetchSalaries, fetchOtherIncomes, fetchProjects, fetchMonthProjectFunds, fetchCategoryBudgets, fetchLoans, fetchLoanPayments, fetchPlannedExpenses, fetchAccounts]);

  useEffect(() => {
    fetchExpenses();
    fetchIncomes();
    fetchFixedPayments();
    fetchLoanPayments();
    fetchMonthProjectFunds();
    fetchCategoryBudgets();
  }, [selectedMonth, selectedYear, fetchExpenses, fetchIncomes, fetchFixedPayments, fetchLoanPayments, fetchMonthProjectFunds, fetchCategoryBudgets]);

  useEffect(() => {
    fetchSavings();
    fetchSalaries();
    fetchOtherIncomes();
  }, [selectedYear, fetchSavings, fetchSalaries, fetchOtherIncomes]);

  useEffect(() => {
    fetchSavedInPeriod();
  }, [fetchSavedInPeriod]);

  /** Rafraîchit toutes les données pour garder totaux et historique synchronisés */
  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchConfig(),
      fetchExpenses(),
      fetchIncomes(),
      fetchFixedPayments(),
      fetchSavings(),
      fetchSalaries(),
      fetchOtherIncomes(),
      fetchProjects(),
      fetchMonthProjectFunds(),
      fetchCategoryBudgets(),
      fetchLoans(),
      fetchLoanPayments(),
      fetchPlannedExpenses(),
      fetchAccounts(),
    ]);
    await fetchSavedInPeriod();
  }, [fetchConfig, fetchExpenses, fetchIncomes, fetchFixedPayments, fetchSavings, fetchSalaries, fetchOtherIncomes, fetchProjects, fetchMonthProjectFunds, fetchCategoryBudgets, fetchLoans, fetchLoanPayments, fetchPlannedExpenses, fetchAccounts, fetchSavedInPeriod]);

  const updateCategoryBudget = useCallback(
    async (categoryId: string, amount: number) => {
      const r = await fetch("/api/category-budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
          category_id: categoryId,
          amount: Math.max(0, amount),
        }),
      });
      if (r.ok) {
        setCategoryBudgets((prev) => ({ ...prev, [categoryId]: Math.max(0, amount) }));
        return true;
      }
      return false;
    },
    [selectedMonth, selectedYear]
  );

  const addExpense = useCallback(
    async (exp: Omit<Expense, "id" | "created_at">) => {
      const r = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exp),
      });
      if (r.ok) {
        await Promise.all([fetchExpenses(), fetchAccounts()]);
        invalidateHistoryCache();
        return true;
      }
      return false;
    },
    [fetchExpenses, fetchAccounts]
  );

  const removeExpense = useCallback(async (id: number) => {
    const r = await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      await Promise.all([fetchExpenses(), fetchPlannedExpenses(), fetchLoans(), fetchLoanPayments(), fetchAccounts()]);
      invalidateHistoryCache();
    }
  }, [fetchExpenses, fetchPlannedExpenses, fetchLoans, fetchLoanPayments, fetchAccounts]);

  const updateExpense = useCallback(
    async (id: number, updates: Partial<Omit<Expense, "id" | "created_at">>) => {
      const r = await fetch("/api/expenses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (r.ok) {
        await Promise.all([fetchExpenses(), fetchAccounts()]);
        invalidateHistoryCache();
        return true;
      }
      return false;
    },
    [fetchExpenses, fetchAccounts]
  );

  const addIncome = useCallback(
    async (inc: Omit<Income, "id" | "created_at">) => {
      const r = await fetch("/api/incomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inc),
      });
      if (r.ok) {
        await Promise.all([fetchIncomes(), fetchAccounts()]);
        invalidateHistoryCache();
        return true;
      }
      return false;
    },
    [fetchIncomes, fetchAccounts]
  );

  const removeIncome = useCallback(async (id: number) => {
    const r = await fetch(`/api/incomes?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      await Promise.all([fetchIncomes(), fetchLoans(), fetchLoanPayments(), fetchAccounts()]);
      invalidateHistoryCache();
    }
  }, [fetchIncomes, fetchLoans, fetchLoanPayments, fetchAccounts]);

  const addFixedPayment = useCallback(
    async (p: Omit<FixedChargePayment, "id" | "created_at">) => {
      const r = await fetch("/api/fixed-charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      if (r.ok) {
        await Promise.all([fetchFixedPayments(), fetchAccounts()]);
        invalidateHistoryCache();
        return true;
      }
      return false;
    },
    [fetchFixedPayments, fetchAccounts]
  );

  const removeFixedPayment = useCallback(async (id: number) => {
    const r = await fetch(`/api/fixed-charges?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      await fetchFixedPayments();
      invalidateHistoryCache();
    }
  }, [fetchFixedPayments]);

  const addLoan = useCallback(
    async (
      l: Omit<Loan, "id" | "created_at">,
      isExisting = false,
      monthsPaid = 0,
      schedule?: LoanScheduleInput[],
      /** Si true, ne crée pas la dépense/revenu initial (ex: monnaie laissée chez le commerçant) */
      skipInitialTransaction = false
    ): Promise<Loan | false> => {
      const r = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(l),
      });
      if (!r.ok) return false;

      const newLoan: Loan = await r.json();

      if (l.type === "bank" && Array.isArray(schedule) && schedule.length > 0) {
        const schedRes = await fetch("/api/loan-schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ loan_id: newLoan.id, schedule }),
        });
        if (!schedRes.ok) return false;
      } else if (isExisting && monthsPaid > 0 && l.monthly_payment > 0) {
      const startDate = new Date(l.start_date || new Date().toISOString().split("T")[0]);
      const payments = [];
      for (let i = 0; i < monthsPaid; i++) {
        const payDate = new Date(startDate);
        payDate.setMonth(payDate.getMonth() + i);
        payments.push({
          amount: l.monthly_payment,
          fees: 0,
          date: payDate.toISOString().split("T")[0],
          time: "00:00",
          notes: `Échéance ${i + 1}/${monthsPaid} (historique)`,
        });
      }
      await fetch("/api/loan-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch: true, loan_id: newLoan.id, payments }),
      });
    } else if (!isExisting && !skipInitialTransaction) {
      const now = new Date();
      const date = l.start_date || now.toISOString().split("T")[0];
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      if (l.type === "personal_lent") {
        await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date, time,
            description: `Prêt à ${l.lender_borrower || "un proche"} — ${l.label}`,
            category: "misc",
            amount: l.total_amount,
            notes: `Prêt personnel: ${l.label}`,
            account_id: l.payment_account_id ?? undefined,
          }),
        });
        await fetchExpenses();
      } else {
        await fetch("/api/incomes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date, time,
            description: l.type === "bank"
              ? `Crédit ${l.lender_borrower || "bancaire"} — ${l.label}`
              : `Emprunt de ${l.lender_borrower || "un proche"} — ${l.label}`,
            source: "other",
            amount: l.total_amount,
            notes: l.type === "bank" ? `Prêt bancaire: ${l.label}` : `Emprunt personnel: ${l.label}`,
            account_id: l.payment_account_id ?? undefined,
          }),
        });
        await fetchIncomes();
      }
    }

    await Promise.all([fetchLoans(), fetchLoanPayments(), fetchAccounts()]);
    invalidateHistoryCache();
    return newLoan;
  },
    [fetchLoans, fetchLoanPayments, fetchExpenses, fetchIncomes, fetchAccounts]
  );

  const updateLoan = useCallback(async (id: number, updates: Partial<Loan>) => {
    const r = await fetch("/api/loans", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...updates }) });
    if (r.ok) {
      await fetchLoans();
      invalidateHistoryCache();
    }
  }, [fetchLoans]);

  const regenerateLoanSchedule = useCallback(async (loanId: number): Promise<boolean> => {
    const r = await fetch(`/api/loans/${loanId}/regenerate-schedule`, { method: "POST" });
    if (r.ok) {
      await fetchLoans();
      invalidateHistoryCache();
      return true;
    }
    return false;
  }, [fetchLoans]);

  const removeLoan = useCallback(async (id: number) => {
    const r = await fetch(`/api/loans?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      await Promise.all([fetchLoans(), fetchLoanPayments()]);
      invalidateHistoryCache();
    }
  }, [fetchLoans, fetchLoanPayments]);

  const addLoanPayment = useCallback(async (p: Omit<LoanPayment, "id" | "created_at">, opts?: { accountId?: number }) => {
    const body = { ...p, ...(opts?.accountId != null ? { account_id: opts.accountId } : {}) };
    const r = await fetch("/api/loan-payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) {
      await Promise.all([
        fetchLoanPayments(),
        fetchLoans(),
        fetchExpenses(),
        fetchIncomes(),
        fetchAccounts(),
      ]);
      invalidateHistoryCache();
      return true;
    }
    return false;
  }, [fetchLoanPayments, fetchLoans, fetchExpenses, fetchIncomes, fetchAccounts]);

  const updateLoanPayment = useCallback(async (id: number, updates: Partial<Pick<LoanPayment, "amount" | "fees" | "date" | "time" | "notes">>) => {
    const r = await fetch(`/api/loan-payments?id=${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
    if (r.ok) {
      await Promise.all([
        fetchLoanPayments(),
        fetchLoans(),
        fetchExpenses(),
        fetchIncomes(),
        fetchAccounts(),
      ]);
      invalidateHistoryCache();
      return true;
    }
    return false;
  }, [fetchLoanPayments, fetchLoans, fetchExpenses, fetchIncomes, fetchAccounts]);

  const removeLoanPayment = useCallback(async (id: number) => {
    const r = await fetch(`/api/loan-payments?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      await Promise.all([
        fetchLoanPayments(),
        fetchLoans(),
        fetchExpenses(),
        fetchIncomes(),
        fetchAccounts(),
      ]);
      invalidateHistoryCache();
    }
  }, [fetchLoanPayments, fetchLoans, fetchExpenses, fetchIncomes, fetchAccounts]);

  const fetchSchedule = useCallback(async (loanId: number): Promise<LoanScheduleRow[]> => {
    const r = await fetch(`/api/loan-schedule?loan_id=${loanId}`);
    if (r.ok) return r.json();
    return [];
  }, []);

  const markSchedulePaid = useCallback(
    async (loanId: number, number: number, note?: string, amount?: number): Promise<boolean> => {
      const r = await fetch("/api/loan-schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loan_id: loanId, number, action: "pay", note, amount }),
      });
      if (r.ok) {
        await Promise.all([fetchLoans(), fetchLoanPayments(), fetchExpenses(), fetchAccounts()]);
        invalidateHistoryCache();
        return true;
      }
      return false;
    },
    [fetchLoans, fetchLoanPayments, fetchExpenses, fetchAccounts]
  );

  const markScheduleUnpaid = useCallback(
    async (loanId: number, number: number): Promise<boolean> => {
      const r = await fetch("/api/loan-schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loan_id: loanId, number, action: "unpay" }),
      });
      if (r.ok) {
        await Promise.all([fetchLoans(), fetchLoanPayments(), fetchExpenses(), fetchAccounts()]);
        invalidateHistoryCache();
        return true;
      }
      return false;
    },
    [fetchLoans, fetchLoanPayments, fetchExpenses, fetchAccounts]
  );

  const updateScheduleRow = useCallback(
    async (
      loanId: number,
      number: number,
      updates: { due_date?: string; principal?: number; interest?: number; insurance?: number; tax_interest?: number; tax_insurance?: number; fees?: number; total_payment?: number; remaining_balance?: number; paid_amount?: number }
    ): Promise<LoanScheduleRow | null> => {
      const r = await fetch("/api/loan-schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loan_id: loanId, number, action: "update", updates }),
      });
      if (r.ok) {
        await Promise.all([fetchLoans(), fetchExpenses(), fetchAccounts()]);
        invalidateHistoryCache();
        return r.json();
      }
      return null;
    },
    [fetchLoans, fetchExpenses, fetchAccounts]
  );

  const addPlannedExpense = useCallback(async (p: Omit<PlannedExpense, "id" | "created_at" | "expense_id">) => {
    const r = await fetch("/api/planned-expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    if (r.ok) {
      await fetchPlannedExpenses();
      invalidateHistoryCache();
      return true;
    }
    return false;
  }, [fetchPlannedExpenses]);

  const updatePlannedExpense = useCallback(async (id: number, updates: Partial<PlannedExpense>) => {
    const r = await fetch("/api/planned-expenses", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...updates }) });
    if (r.ok) {
      await fetchPlannedExpenses();
      invalidateHistoryCache();
    }
  }, [fetchPlannedExpenses]);

  const removePlannedExpense = useCallback(async (id: number) => {
    const r = await fetch(`/api/planned-expenses?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      await Promise.all([fetchPlannedExpenses(), fetchExpenses()]);
      invalidateHistoryCache();
    }
  }, [fetchPlannedExpenses, fetchExpenses]);

  const executePlannedExpense = useCallback(async (id: number) => {
    const r = await fetch(`/api/planned-expenses?execute_id=${id}`);
    if (r.ok) {
      await Promise.all([fetchPlannedExpenses(), fetchExpenses(), fetchAccounts()]);
      invalidateHistoryCache();
      return true;
    }
    return false;
  }, [fetchPlannedExpenses, fetchExpenses, fetchAccounts]);

  const executeAllDuePlanned = useCallback(async () => {
    await fetch("/api/planned-expenses?execute=true");
    await Promise.all([fetchPlannedExpenses(), fetchExpenses(), fetchAccounts()]);
    invalidateHistoryCache();
  }, [fetchPlannedExpenses, fetchExpenses, fetchAccounts]);

  const updateConfig = useCallback(
    async (newConfig: BudgetConfig) => {
      setConfig(newConfig);
      await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });
    },
    []
  );

  const updateSaving = useCallback(
    async (month: number, amount: number) => {
      let previous = 0;
      setSavings((prev) => {
        previous = prev[month] ?? 0;
        const ns = [...prev];
        ns[month] = amount;
        return ns;
      });
      const r = await fetch("/api/savings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year: selectedYear, amount }),
      });
      if (!r.ok) {
        setSavings((prev) => {
          const ns = [...prev];
          ns[month] = previous;
          return ns;
        });
        return;
      }
      await Promise.all([fetchSavings(), fetchSavedInPeriod(), fetchAccounts()]);
      invalidateHistoryCache();
    },
    [selectedYear, fetchSavings, fetchSavedInPeriod, fetchAccounts]
  );

  const updateSalary = useCallback(
    async (month: number, amount: number, accountOverride?: number | null) => {
      const year = selectedYear ?? new Date().getFullYear();
      const accountId =
        accountOverride !== undefined ? accountOverride : salaryAccountIds[month] ?? null;
      const ns = [...salaries];
      ns[month] = amount;
      setSalaries(ns);
      if (accountOverride !== undefined) {
        const na = [...salaryAccountIds];
        na[month] = accountOverride;
        setSalaryAccountIds(na);
      }
      const r = await fetch("/api/salaries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          year,
          amount: Math.max(0, amount),
          account_id: accountId,
        }),
      });
      if (r.ok) {
        await Promise.all([fetchIncomes(), fetchAccounts()]);
      }
      invalidateHistoryCache();
    },
    [salaries, salaryAccountIds, selectedYear, fetchIncomes, fetchAccounts]
  );

  const updateOtherIncome = useCallback(
    async (month: number, amount: number) => {
      const ns = [...otherIncomes];
      ns[month] = amount;
      setOtherIncomes(ns);
      await fetch("/api/other-incomes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year: selectedYear, amount }),
      });
      invalidateHistoryCache();
    },
    [otherIncomes, selectedYear]
  );

  const addProject = useCallback(
    async (p: Omit<Project, "id" | "created_at">) => {
      const r = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      if (r.ok) {
        await fetchProjects();
        invalidateHistoryCache();
        return true;
      }
      return false;
    },
    [fetchProjects]
  );

  const updateProjectData = useCallback(
    async (id: number, updates: Partial<Project>) => {
      const r = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (r.ok) {
        await fetchProjects();
        invalidateHistoryCache();
      }
    },
    [fetchProjects]
  );

  const removeProject = useCallback(async (id: number) => {
    const r = await fetch(`/api/projects?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      await Promise.all([fetchProjects(), fetchExpenses(), fetchMonthProjectFunds()]);
      invalidateHistoryCache();
    }
  }, [fetchProjects, fetchExpenses, fetchMonthProjectFunds]);

  const totalFixed = useMemo(
    () => fixedPayments.reduce((s, p) => s + p.amount, 0),
    [fixedPayments]
  );

  // Revenus saisis (hors fonds projet : ceux-ci sont prélevés du solde, comme l'épargne)
  const totalMonthIncomes = useMemo(
    () =>
      incomes
        .filter(
          (i) => i.source !== "project" && i.source !== INCOME_SOURCE_SALARY_SETTINGS,
        )
        .reduce((s, i) => s + i.amount, 0),
    [incomes],
  );

  const catSpending = useMemo(() => {
    const map: Record<string, number> = {};
    config.categories.forEach((c) => {
      map[c.id] = 0;
    });
    expenses.forEach((e) => {
      const total = e.amount + (e.transaction_fee ?? 0);
      map[e.category] = (map[e.category] || 0) + total;
    });
    return map;
  }, [expenses, config.categories]);

  const totalMonthSpent = useMemo(
    () => Object.values(catSpending).reduce((a, b) => a + b, 0),
    [catSpending]
  );

  const monthSaving = savings[selectedMonth] || 0;
  const monthSalary = salaries[selectedMonth] || 0;
  const monthOtherIncome = otherIncomes[selectedMonth] || 0;

  const loansById = useMemo(() => {
    const map: Record<number, Loan> = {};
    loans.forEach((l) => { map[l.id] = l; });
    return map;
  }, [loans]);

  // Sorties trésorerie : remboursements de prêts bancaires + emprunts perso
  const monthLoanRepayments = useMemo(
    () => loanPayments
      .filter((p) => { const l = loansById[p.loan_id]; return l && l.type !== "personal_lent"; })
      .reduce((s, p) => s + p.amount + p.fees, 0),
    [loanPayments, loansById]
  );

  // Entrées trésorerie : remboursements reçus des prêts perso (j'ai prêté)
  const monthLoanRecovered = useMemo(
    () => loanPayments
      .filter((p) => { const l = loansById[p.loan_id]; return l && l.type === "personal_lent"; })
      .reduce((s, p) => s + p.amount, 0),
    [loanPayments, loansById]
  );

  // Total flux prêts du mois (pour affichage)
  const monthLoanPayments = monthLoanRepayments + monthLoanRecovered;

  const totalDebt = useMemo(
    () => loans.filter((l) => l.status === "active" && l.type !== "personal_lent").reduce((s, l) => s + l.remaining_amount, 0),
    [loans]
  );

  const totalSavedManual = useMemo(
    () => savings.reduce((a, b) => a + b, 0),
    [savings]
  );

  const totalProjectSaved = useMemo(
    () => projects.reduce((s, p) => s + p.saved_amount, 0),
    [projects]
  );

  const totalSaved = totalSavedManual + totalProjectSaved;

  // Actifs : salaire + autres revenus (par mois) + revenus saisis + remboursements reçus (prêts perso)
  const totalIncome = monthSalary + monthOtherIncome + totalMonthIncomes + monthLoanRecovered;
  // Passifs : charges fixes + dépenses + épargne + fonds projet (prélevés du solde) + remboursements dettes
  const totalExpenses = totalFixed + totalMonthSpent + monthSaving + monthProjectFunds + monthLoanRepayments;
  // Solde net du mois (flux) = entrées déclarées − sorties budgétées
  const soldeNet = totalIncome - totalExpenses;
  // Reste à vivre budgété (avant dépenses variables et épargne)
  const resteAVivre = totalIncome - totalFixed;

  /** Soldes par compte (trésorerie réelle). */
  const accountsWithBalance = useMemo(() => accountsFromApi, [accountsFromApi]);

  const totalTreasuryBalances = useMemo(
    () => sumActiveAccountBalances(accountsFromApi),
    [accountsFromApi],
  );

  const soldeDisponibleLiquide = useMemo(
    () => sumLiquideCashAndMobileMoney(accountsFromApi),
    [accountsFromApi],
  );

  /** Actifs affichés = trésorerie seule (soldes comptes) ; les entrées du mois sont déjà dans ces soldes. */
  const totalActifsKpi = totalTreasuryBalances;

  /** Budget effectif par catégorie pour le mois sélectionné (override mensuel ou défaut config) */
  const effectiveCategoryBudgets = useMemo(() => {
    const map: Record<string, number> = {};
    config.categories.forEach((c) => {
      map[c.id] = categoryBudgets[c.id] ?? c.budget;
    });
    return map;
  }, [config.categories, categoryBudgets]);

  const totalBudgetVar = useMemo(
    () => Object.values(effectiveCategoryBudgets).reduce((s, v) => s + v, 0),
    [effectiveCategoryBudgets]
  );
  const daysLeft = getDaysLeftInMonth(selectedMonth, selectedYear);
  /** Budget / jour basé sur le liquide espèces + mobile money (pas le solde net mensuel). */
  const dailyBudget =
    soldeDisponibleLiquide > 0
      ? Math.round(soldeDisponibleLiquide / Math.max(1, daysLeft))
      : 0;

  return {
    config,
    expenses,
    incomes,
    fixedPayments,
    loans,
    loanPayments,
    savings,
    salaries,
    salaryAccountIds,
    otherIncomes,
    updateOtherIncome,
    projects,
    selectedMonth,
    selectedYear,
    loading,
    setSelectedMonth,
    setSelectedYear,
    addExpense,
    updateExpense,
    removeExpense,
    addIncome,
    removeIncome,
    addFixedPayment,
    removeFixedPayment,
    addLoan,
    updateLoan,
    regenerateLoanSchedule,
    removeLoan,
    addLoanPayment,
    updateLoanPayment,
    removeLoanPayment,
    fetchSchedule,
    markSchedulePaid,
    markScheduleUnpaid,
    updateScheduleRow,
    updateConfig,
    fetchConfig,
    updateSaving,
    updateSalary,
    addProject,
    updateProject: updateProjectData,
    removeProject,
    fetchProjects,
    fetchMonthProjectFunds,
    addToMonthProjectFunds,
    refreshAll,
    invalidateHistoryCache,
    fetchExpenses,
    fetchIncomes,
    totalFixed,
    totalIncome,
    totalExpenses,
    soldeNet,
    soldeDisponibleLiquide,
    totalTreasuryBalances,
    totalActifsKpi,
    resteAVivre,
    totalBudgetVar,
    effectiveCategoryBudgets,
    updateCategoryBudget,
    dailyBudget,
    totalSaved,
    totalSavedManualCumulative,
    savedInPeriod,
    totalProjectSaved,
    monthSalary,
    monthSaving,
    monthProjectFunds,
    catSpending,
    totalMonthSpent,
    totalMonthIncomes,
    monthLoanPayments,
    monthLoanRepayments,
    monthLoanRecovered,
    totalDebt,
    daysLeftInMonth: daysLeft,
    plannedExpenses,
    addPlannedExpense,
    updatePlannedExpense,
    removePlannedExpense,
    executePlannedExpense,
    executeAllDuePlanned,
    accountsWithBalance,
    accountsRevision,
    fetchAccounts,
  };
}
