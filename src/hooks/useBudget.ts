"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { mutate } from "swr";
import { BudgetConfig, Expense, Income, Project, FixedChargePayment, Loan, LoanPayment, PlannedExpense } from "@/lib/types";
import { DEFAULT_CONFIG } from "@/lib/constants";

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
  const [salaries, setSalaries] = useState<number[]>(Array(12).fill(0));
  const [projects, setProjects] = useState<Project[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanPayments, setLoanPayments] = useState<LoanPayment[]>([]);
  const [plannedExpenses, setPlannedExpenses] = useState<PlannedExpense[]>([]);
  const [monthProjectFunds, setMonthProjectFunds] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

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

  const fetchSalaries = useCallback(async () => {
    try {
      const r = await fetch(`/api/salaries?year=${selectedYear}`);
      if (r.ok) setSalaries(await r.json());
    } catch { /* ignore */ }
  }, [selectedYear]);

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
      await fetch("/api/planned-expenses?execute=true");
      const r = await fetch("/api/planned-expenses");
      if (r.ok) { const data = await r.json(); setPlannedExpenses(Array.isArray(data) ? data : []); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    Promise.all([
      fetchConfig(),
      fetchExpenses(),
      fetchIncomes(),
      fetchFixedPayments(),
      fetchSavings(),
      fetchSalaries(),
      fetchProjects(),
      fetchMonthProjectFunds(),
      fetchLoans(),
      fetchLoanPayments(),
      fetchPlannedExpenses(),
    ]).then(() => setLoading(false));
  }, [fetchConfig, fetchExpenses, fetchIncomes, fetchFixedPayments, fetchSavings, fetchSalaries, fetchProjects, fetchMonthProjectFunds, fetchLoans, fetchLoanPayments, fetchPlannedExpenses]);

  useEffect(() => {
    fetchExpenses();
    fetchIncomes();
    fetchFixedPayments();
    fetchLoanPayments();
    fetchMonthProjectFunds();
  }, [selectedMonth, selectedYear, fetchExpenses, fetchIncomes, fetchFixedPayments, fetchLoanPayments, fetchMonthProjectFunds]);

  useEffect(() => {
    fetchSavings();
    fetchSalaries();
  }, [selectedYear, fetchSavings, fetchSalaries]);

  /** Rafraîchit toutes les données pour garder totaux et historique synchronisés */
  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchConfig(),
      fetchExpenses(),
      fetchIncomes(),
      fetchFixedPayments(),
      fetchSavings(),
      fetchSalaries(),
      fetchProjects(),
      fetchMonthProjectFunds(),
      fetchLoans(),
      fetchLoanPayments(),
      fetchPlannedExpenses(),
    ]);
  }, [fetchConfig, fetchExpenses, fetchIncomes, fetchFixedPayments, fetchSavings, fetchSalaries, fetchProjects, fetchMonthProjectFunds, fetchLoans, fetchLoanPayments, fetchPlannedExpenses]);

  const addExpense = useCallback(
    async (exp: Omit<Expense, "id" | "created_at">) => {
      const r = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exp),
      });
      if (r.ok) {
        await fetchExpenses();
        invalidateHistoryCache();
        return true;
      }
      return false;
    },
    [fetchExpenses]
  );

  const removeExpense = useCallback(async (id: number) => {
    const r = await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      await Promise.all([fetchExpenses(), fetchPlannedExpenses()]);
      invalidateHistoryCache();
    }
  }, [fetchExpenses, fetchPlannedExpenses]);

  const updateExpense = useCallback(
    async (id: number, updates: Partial<Omit<Expense, "id" | "created_at">>) => {
      const r = await fetch("/api/expenses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (r.ok) {
        await fetchExpenses();
        invalidateHistoryCache();
        return true;
      }
      return false;
    },
    [fetchExpenses]
  );

  const addIncome = useCallback(
    async (inc: Omit<Income, "id" | "created_at">) => {
      const r = await fetch("/api/incomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inc),
      });
      if (r.ok) {
        await fetchIncomes();
        invalidateHistoryCache();
        return true;
      }
      return false;
    },
    [fetchIncomes]
  );

  const removeIncome = useCallback(async (id: number) => {
    const r = await fetch(`/api/incomes?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      await fetchIncomes();
      invalidateHistoryCache();
    }
  }, [fetchIncomes]);

  const addFixedPayment = useCallback(
    async (p: Omit<FixedChargePayment, "id" | "created_at">) => {
      const r = await fetch("/api/fixed-charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      if (r.ok) {
        await fetchFixedPayments();
        invalidateHistoryCache();
        return true;
      }
      return false;
    },
    [fetchFixedPayments]
  );

  const removeFixedPayment = useCallback(async (id: number) => {
    const r = await fetch(`/api/fixed-charges?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      await fetchFixedPayments();
      invalidateHistoryCache();
    }
  }, [fetchFixedPayments]);

  const addLoan = useCallback(async (l: Omit<Loan, "id" | "created_at">, isExisting = false, monthsPaid = 0) => {
    const r = await fetch("/api/loans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(l) });
    if (!r.ok) return false;

    const newLoan = await r.json();

    if (isExisting && monthsPaid > 0 && l.monthly_payment > 0) {
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
    } else if (!isExisting) {
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
          }),
        });
        await fetchIncomes();
      }
    }

    await Promise.all([fetchLoans(), fetchLoanPayments()]);
    invalidateHistoryCache();
    return true;
  }, [fetchLoans, fetchLoanPayments, fetchExpenses, fetchIncomes]);

  const updateLoan = useCallback(async (id: number, updates: Partial<Loan>) => {
    const r = await fetch("/api/loans", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...updates }) });
    if (r.ok) {
      await fetchLoans();
      invalidateHistoryCache();
    }
  }, [fetchLoans]);

  const removeLoan = useCallback(async (id: number) => {
    const r = await fetch(`/api/loans?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      await Promise.all([fetchLoans(), fetchLoanPayments()]);
      invalidateHistoryCache();
    }
  }, [fetchLoans, fetchLoanPayments]);

  const addLoanPayment = useCallback(async (p: Omit<LoanPayment, "id" | "created_at">) => {
    const r = await fetch("/api/loan-payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    if (r.ok) {
      await Promise.all([fetchLoanPayments(), fetchLoans()]);
      invalidateHistoryCache();
      return true;
    }
    return false;
  }, [fetchLoanPayments, fetchLoans]);

  const updateLoanPayment = useCallback(async (id: number, updates: Partial<Pick<LoanPayment, "amount" | "fees" | "date" | "time" | "notes">>) => {
    const r = await fetch(`/api/loan-payments?id=${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
    if (r.ok) {
      await Promise.all([fetchLoanPayments(), fetchLoans()]);
      invalidateHistoryCache();
      return true;
    }
    return false;
  }, [fetchLoanPayments, fetchLoans]);

  const removeLoanPayment = useCallback(async (id: number) => {
    const r = await fetch(`/api/loan-payments?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      await Promise.all([fetchLoanPayments(), fetchLoans()]);
      invalidateHistoryCache();
    }
  }, [fetchLoanPayments, fetchLoans]);

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
      await Promise.all([fetchPlannedExpenses(), fetchExpenses()]);
      invalidateHistoryCache();
      return true;
    }
    return false;
  }, [fetchPlannedExpenses, fetchExpenses]);

  const executeAllDuePlanned = useCallback(async () => {
    await fetch("/api/planned-expenses?execute=true");
    await Promise.all([fetchPlannedExpenses(), fetchExpenses()]);
    invalidateHistoryCache();
  }, [fetchPlannedExpenses, fetchExpenses]);

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
      const ns = [...savings];
      ns[month] = amount;
      setSavings(ns);
      await fetch("/api/savings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year: selectedYear, amount }),
      });
      await fetchSavings();
      invalidateHistoryCache();
    },
    [savings, selectedYear, fetchSavings]
  );

  const updateSalary = useCallback(
    async (month: number, amount: number) => {
      const ns = [...salaries];
      ns[month] = amount;
      setSalaries(ns);
      await fetch("/api/salaries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year: selectedYear, amount }),
      });
      invalidateHistoryCache();
    },
    [salaries, selectedYear]
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
    () => incomes.filter((i) => i.source !== "project").reduce((s, i) => s + i.amount, 0),
    [incomes]
  );

  const catSpending = useMemo(() => {
    const map: Record<string, number> = {};
    config.categories.forEach((c) => {
      map[c.id] = 0;
    });
    expenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return map;
  }, [expenses, config.categories]);

  const totalMonthSpent = useMemo(
    () => Object.values(catSpending).reduce((a, b) => a + b, 0),
    [catSpending]
  );

  const monthSaving = savings[selectedMonth] || 0;
  const monthSalary = salaries[selectedMonth] || 0;

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

  // Actifs : salaire + autres revenus + revenus saisis + remboursements reçus (prêts perso)
  const totalIncome = monthSalary + config.otherIncome + totalMonthIncomes + monthLoanRecovered;
  // Passifs : charges fixes + dépenses + épargne + fonds projet (prélevés du solde) + remboursements dettes
  const totalExpenses = totalFixed + totalMonthSpent + monthSaving + monthProjectFunds + monthLoanRepayments;
  // Solde net = Actifs - Passifs
  const soldeNet = totalIncome - totalExpenses;
  // Reste à vivre budgété (avant dépenses variables et épargne)
  const resteAVivre = totalIncome - totalFixed;
  const totalBudgetVar = useMemo(
    () => config.categories.reduce((s, c) => s + c.budget, 0),
    [config]
  );
  const daysLeft = getDaysLeftInMonth(selectedMonth, selectedYear);
  const dailyBudget = soldeNet > 0 ? Math.round(soldeNet / Math.max(1, daysLeft)) : 0;

  return {
    config,
    expenses,
    incomes,
    fixedPayments,
    loans,
    loanPayments,
    savings,
    salaries,
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
    removeLoan,
    addLoanPayment,
    updateLoanPayment,
    removeLoanPayment,
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
    resteAVivre,
    totalBudgetVar,
    dailyBudget,
    totalSaved,
    totalSavedManualCumulative,
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
  };
}
