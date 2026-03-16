"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { BudgetConfig, Expense, Income, Project, FixedChargePayment, Loan, LoanPayment, PlannedExpense } from "@/lib/types";
import { DEFAULT_CONFIG } from "@/lib/constants";

function daysLeftInMonth(): number {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate() + 1;
}

export function useBudget() {
  const [config, setConfig] = useState<BudgetConfig>(DEFAULT_CONFIG);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [fixedPayments, setFixedPayments] = useState<FixedChargePayment[]>([]);
  const [savings, setSavings] = useState<number[]>(Array(12).fill(0));
  const [salaries, setSalaries] = useState<number[]>(Array(12).fill(0));
  const [projects, setProjects] = useState<Project[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanPayments, setLoanPayments] = useState<LoanPayment[]>([]);
  const [plannedExpenses, setPlannedExpenses] = useState<PlannedExpense[]>([]);
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
      const r = await fetch(`/api/savings?year=${selectedYear}`);
      if (r.ok) setSavings(await r.json());
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
      fetchLoans(),
      fetchLoanPayments(),
      fetchPlannedExpenses(),
    ]).then(() => setLoading(false));
  }, [fetchConfig, fetchExpenses, fetchIncomes, fetchFixedPayments, fetchSavings, fetchSalaries, fetchProjects, fetchLoans, fetchLoanPayments, fetchPlannedExpenses]);

  useEffect(() => {
    fetchExpenses();
    fetchIncomes();
    fetchFixedPayments();
    fetchLoanPayments();
  }, [selectedMonth, selectedYear, fetchExpenses, fetchIncomes, fetchFixedPayments, fetchLoanPayments]);

  useEffect(() => {
    fetchSavings();
    fetchSalaries();
  }, [selectedYear, fetchSavings, fetchSalaries]);

  const addExpense = useCallback(
    async (exp: Omit<Expense, "id" | "created_at">) => {
      const r = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exp),
      });
      if (r.ok) {
        await fetchExpenses();
        return true;
      }
      return false;
    },
    [fetchExpenses]
  );

  const removeExpense = useCallback(async (id: number) => {
    const r = await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
    if (r.ok) setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const addIncome = useCallback(
    async (inc: Omit<Income, "id" | "created_at">) => {
      const r = await fetch("/api/incomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inc),
      });
      if (r.ok) {
        await fetchIncomes();
        return true;
      }
      return false;
    },
    [fetchIncomes]
  );

  const removeIncome = useCallback(async (id: number) => {
    const r = await fetch(`/api/incomes?id=${id}`, { method: "DELETE" });
    if (r.ok) setIncomes((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const addFixedPayment = useCallback(
    async (p: Omit<FixedChargePayment, "id" | "created_at">) => {
      const r = await fetch("/api/fixed-charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      if (r.ok) {
        await fetchFixedPayments();
        return true;
      }
      return false;
    },
    [fetchFixedPayments]
  );

  const removeFixedPayment = useCallback(async (id: number) => {
    const r = await fetch(`/api/fixed-charges?id=${id}`, { method: "DELETE" });
    if (r.ok) setFixedPayments((prev) => prev.filter((p) => p.id !== id));
  }, []);

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
    return true;
  }, [fetchLoans, fetchLoanPayments, fetchExpenses, fetchIncomes]);

  const updateLoan = useCallback(async (id: number, updates: Partial<Loan>) => {
    const r = await fetch("/api/loans", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...updates }) });
    if (r.ok) await fetchLoans();
  }, [fetchLoans]);

  const removeLoan = useCallback(async (id: number) => {
    const r = await fetch(`/api/loans?id=${id}`, { method: "DELETE" });
    if (r.ok) setLoans((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const addLoanPayment = useCallback(async (p: Omit<LoanPayment, "id" | "created_at">) => {
    const r = await fetch("/api/loan-payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    if (r.ok) { await Promise.all([fetchLoanPayments(), fetchLoans()]); return true; }
    return false;
  }, [fetchLoanPayments, fetchLoans]);

  const removeLoanPayment = useCallback(async (id: number) => {
    const r = await fetch(`/api/loan-payments?id=${id}`, { method: "DELETE" });
    if (r.ok) { await Promise.all([fetchLoanPayments(), fetchLoans()]); }
  }, [fetchLoanPayments, fetchLoans]);

  const addPlannedExpense = useCallback(async (p: Omit<PlannedExpense, "id" | "created_at" | "expense_id">) => {
    const r = await fetch("/api/planned-expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    if (r.ok) { await fetchPlannedExpenses(); return true; }
    return false;
  }, [fetchPlannedExpenses]);

  const updatePlannedExpense = useCallback(async (id: number, updates: Partial<PlannedExpense>) => {
    const r = await fetch("/api/planned-expenses", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...updates }) });
    if (r.ok) await fetchPlannedExpenses();
  }, [fetchPlannedExpenses]);

  const removePlannedExpense = useCallback(async (id: number) => {
    const r = await fetch(`/api/planned-expenses?id=${id}`, { method: "DELETE" });
    if (r.ok) setPlannedExpenses((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const executePlannedExpense = useCallback(async (id: number) => {
    const r = await fetch(`/api/planned-expenses?execute_id=${id}`);
    if (r.ok) { await Promise.all([fetchPlannedExpenses(), fetchExpenses()]); return true; }
    return false;
  }, [fetchPlannedExpenses, fetchExpenses]);

  const executeAllDuePlanned = useCallback(async () => {
    await fetch("/api/planned-expenses?execute=true");
    await Promise.all([fetchPlannedExpenses(), fetchExpenses()]);
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
    },
    [savings, selectedYear]
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
      if (r.ok) await fetchProjects();
    },
    [fetchProjects]
  );

  const removeProject = useCallback(async (id: number) => {
    const r = await fetch(`/api/projects?id=${id}`, { method: "DELETE" });
    if (r.ok) setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const totalFixed = useMemo(
    () => fixedPayments.reduce((s, p) => s + p.amount, 0),
    [fixedPayments]
  );

  const totalMonthIncomes = useMemo(
    () => incomes.reduce((s, i) => s + i.amount, 0),
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
  // Passifs : charges fixes + dépenses + épargne + remboursements de dettes (banque + emprunts perso)
  const totalExpenses = totalFixed + totalMonthSpent + monthSaving + monthLoanRepayments;
  // Solde net = Actifs - Passifs
  const soldeNet = totalIncome - totalExpenses;
  // Reste à vivre budgété (avant dépenses variables et épargne)
  const resteAVivre = totalIncome - totalFixed;
  const totalBudgetVar = useMemo(
    () => config.categories.reduce((s, c) => s + c.budget, 0),
    [config]
  );
  const dailyBudget = soldeNet > 0 ? Math.round(soldeNet / Math.max(1, daysLeftInMonth())) : 0;

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
    removeExpense,
    addIncome,
    removeIncome,
    addFixedPayment,
    removeFixedPayment,
    addLoan,
    updateLoan,
    removeLoan,
    addLoanPayment,
    removeLoanPayment,
    updateConfig,
    updateSaving,
    updateSalary,
    addProject,
    updateProject: updateProjectData,
    removeProject,
    totalFixed,
    totalIncome,
    totalExpenses,
    soldeNet,
    resteAVivre,
    totalBudgetVar,
    dailyBudget,
    totalSaved,
    totalProjectSaved,
    monthSalary,
    monthSaving,
    catSpending,
    totalMonthSpent,
    totalMonthIncomes,
    monthLoanPayments,
    monthLoanRepayments,
    monthLoanRecovered,
    totalDebt,
    plannedExpenses,
    addPlannedExpense,
    updatePlannedExpense,
    removePlannedExpense,
    executePlannedExpense,
    executeAllDuePlanned,
  };
}
