import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { Expense, Income, Project, ProjectFund, ProjectPurchase, BudgetConfig, MonthlySaving, FixedChargePayment, Loan, LoanPayment, PlannedExpense } from "./types";
import { DEFAULT_CONFIG } from "./constants";

const DB_PATH = path.join(process.cwd(), "data", "budget.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      time TEXT NOT NULL DEFAULT '00:00',
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount > 0),
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS incomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      time TEXT NOT NULL DEFAULT '00:00',
      description TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'other',
      amount INTEGER NOT NULL CHECK(amount > 0),
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS savings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month INTEGER NOT NULL CHECK(month >= 0 AND month <= 11),
      year INTEGER NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      UNIQUE(month, year)
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      target_amount INTEGER NOT NULL DEFAULT 0,
      saved_amount INTEGER NOT NULL DEFAULT 0,
      deadline TEXT DEFAULT '',
      color TEXT DEFAULT '#6366f1',
      icon TEXT DEFAULT 'target',
      status TEXT DEFAULT 'active' CHECK(status IN ('active','completed','paused')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_funds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL CHECK(amount > 0),
      date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_project_funds_project ON project_funds(project_id);

    CREATE TABLE IF NOT EXISTS project_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount > 0),
      date TEXT NOT NULL,
      expense_id INTEGER DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_project_purchases_project ON project_purchases(project_id);

    CREATE TABLE IF NOT EXISTS fixed_charge_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      charge_id TEXT NOT NULL,
      label TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'house',
      amount INTEGER NOT NULL CHECK(amount > 0),
      date TEXT NOT NULL,
      time TEXT NOT NULL DEFAULT '00:00',
      month INTEGER NOT NULL CHECK(month >= 0 AND month <= 11),
      year INTEGER NOT NULL,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_fcp_month_year ON fixed_charge_payments(month, year);

    CREATE TABLE IF NOT EXISTS salaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month INTEGER NOT NULL CHECK(month >= 0 AND month <= 11),
      year INTEGER NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      UNIQUE(month, year)
    );

    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('bank','personal_borrowed','personal_lent')),
      label TEXT NOT NULL,
      lender_borrower TEXT NOT NULL DEFAULT '',
      total_amount INTEGER NOT NULL CHECK(total_amount > 0),
      remaining_amount INTEGER NOT NULL DEFAULT 0,
      interest_rate REAL NOT NULL DEFAULT 0,
      fees INTEGER NOT NULL DEFAULT 0,
      monthly_payment INTEGER NOT NULL DEFAULT 0,
      start_date TEXT NOT NULL,
      end_date TEXT DEFAULT '',
      next_due_date TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','defaulted')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS loan_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL CHECK(amount > 0),
      fees INTEGER NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      time TEXT NOT NULL DEFAULT '00:00',
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS planned_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      due_date TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount > 0),
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','executed','cancelled')),
      expense_id INTEGER DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

    CREATE INDEX IF NOT EXISTS idx_planned_expenses_due ON planned_expenses(due_date);
    CREATE INDEX IF NOT EXISTS idx_planned_expenses_status ON planned_expenses(status);
    CREATE INDEX IF NOT EXISTS idx_loan_payments_loan ON loan_payments(loan_id);
    CREATE INDEX IF NOT EXISTS idx_loan_payments_date ON loan_payments(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
    CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(date);
    CREATE INDEX IF NOT EXISTS idx_savings_year ON savings(year);
    CREATE INDEX IF NOT EXISTS idx_salaries_year ON salaries(year);
  `);

  // Migration: add time column to expenses if missing
  const expCols = db.prepare("PRAGMA table_info(expenses)").all() as { name: string }[];
  if (!expCols.find((c) => c.name === "time")) {
    db.exec("ALTER TABLE expenses ADD COLUMN time TEXT NOT NULL DEFAULT '00:00'");
  }

  // Migration: add avatar_path column to users if missing
  const userCols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (!userCols.find((c) => c.name === "avatar_path")) {
    db.exec("ALTER TABLE users ADD COLUMN avatar_path TEXT DEFAULT NULL");
  }

  // Migration: add income_id to project_funds (lien revenu ↔ fonds projet)
  const pfCols = db.prepare("PRAGMA table_info(project_funds)").all() as { name: string }[];
  if (!pfCols.find((c) => c.name === "income_id")) {
    db.exec("ALTER TABLE project_funds ADD COLUMN income_id INTEGER DEFAULT NULL");
  }

  return db;
}

// Appelé au premier chargement des projets pour migrer les données existantes
let projectFundsMigrationDone = false;
function ensureProjectFundsMigration(): void {
  if (projectFundsMigrationDone) return;
  projectFundsMigrationDone = true;
  try {
    migrateProjectFundsIfNeeded();
  } catch { /* ignore */ }
}

// ── Expenses ──

export function getExpenses(month?: number, year?: number, limit?: number, offset?: number): Expense[] {
  const d = getDb();
  let sql: string;
  let params: (string | number)[];
  if (month !== undefined && year !== undefined) {
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endMonth = month === 11 ? 1 : month + 2;
    const endYear = month === 11 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
    sql = "SELECT * FROM expenses WHERE date >= ? AND date < ? ORDER BY date DESC, time DESC, id DESC";
    params = [startDate, endDate];
  } else {
    sql = "SELECT * FROM expenses ORDER BY date DESC, time DESC, id DESC";
    params = [];
  }
  if (limit !== undefined && limit > 0) {
    sql += " LIMIT ?";
    params.push(limit);
    if (offset !== undefined && offset > 0) {
      sql += " OFFSET ?";
      params.push(offset);
    }
  }
  return d.prepare(sql).all(...params) as Expense[];
}

export function addExpense(
  exp: Omit<Expense, "id" | "created_at">
): Expense {
  const d = getDb();
  const result = d
    .prepare(
      "INSERT INTO expenses (date, time, description, category, amount, notes) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(exp.date, exp.time || "00:00", exp.description, exp.category, exp.amount, exp.notes || "");
  return d
    .prepare("SELECT * FROM expenses WHERE id = ?")
    .get(result.lastInsertRowid) as Expense;
}

export function updateExpense(id: number, updates: Partial<Omit<Expense, "id" | "created_at">>): Expense | null {
  const d = getDb();
  const current = d.prepare("SELECT * FROM expenses WHERE id = ?").get(id) as Expense | undefined;
  if (!current) return null;
  const m = {
    date: updates.date ?? current.date,
    time: updates.time ?? current.time ?? "00:00",
    description: updates.description ?? current.description,
    category: updates.category ?? current.category,
    amount: updates.amount ?? current.amount,
    notes: updates.notes ?? current.notes,
  };
  d.prepare(
    "UPDATE expenses SET date=?, time=?, description=?, category=?, amount=?, notes=? WHERE id=?"
  ).run(m.date, m.time, m.description, m.category, m.amount, m.notes ?? "", id);
  return d.prepare("SELECT * FROM expenses WHERE id = ?").get(id) as Expense;
}

export function deleteExpense(id: number): boolean {
  const d = getDb();
  d.prepare("UPDATE planned_expenses SET expense_id = NULL, status = 'cancelled' WHERE expense_id = ?").run(id);
  return d.prepare("DELETE FROM expenses WHERE id = ?").run(id).changes > 0;
}

export function getExpensesByDateRange(
  start: string,
  end: string
): Expense[] {
  return getDb()
    .prepare(
      "SELECT * FROM expenses WHERE date >= ? AND date <= ? ORDER BY date DESC, time DESC, id DESC"
    )
    .all(start, end) as Expense[];
}

// ── Incomes ──

export function getIncomes(month?: number, year?: number): Income[] {
  const d = getDb();
  if (month !== undefined && year !== undefined) {
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endMonth = month === 11 ? 1 : month + 2;
    const endYear = month === 11 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
    return d
      .prepare(
        "SELECT * FROM incomes WHERE date >= ? AND date < ? ORDER BY date DESC, time DESC, id DESC"
      )
      .all(startDate, endDate) as Income[];
  }
  return d
    .prepare("SELECT * FROM incomes ORDER BY date DESC, time DESC, id DESC")
    .all() as Income[];
}

export function addIncome(
  inc: Omit<Income, "id" | "created_at">
): Income {
  const d = getDb();
  const result = d
    .prepare(
      "INSERT INTO incomes (date, time, description, source, amount, notes) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(inc.date, inc.time || "00:00", inc.description, inc.source || "other", inc.amount, inc.notes || "");
  return d
    .prepare("SELECT * FROM incomes WHERE id = ?")
    .get(result.lastInsertRowid) as Income;
}

export function deleteIncome(id: number): boolean {
  return getDb().prepare("DELETE FROM incomes WHERE id = ?").run(id).changes > 0;
}

export function getIncomesByDateRange(start: string, end: string): Income[] {
  return getDb()
    .prepare("SELECT * FROM incomes WHERE date >= ? AND date <= ? ORDER BY date DESC, time DESC, id DESC")
    .all(start, end) as Income[];
}

// ── Config ──

export function getConfig(): BudgetConfig {
  const d = getDb();
  const row = d
    .prepare("SELECT data FROM config WHERE id = 1")
    .get() as { data: string } | undefined;
  if (row) {
    try {
      return JSON.parse(row.data);
    } catch {
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}

export function saveConfig(config: BudgetConfig): void {
  const d = getDb();
  d.prepare(
    "INSERT INTO config (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data"
  ).run(JSON.stringify(config));
}

// ── Savings ──

export function getSavings(year: number): number[] {
  const d = getDb();
  const rows = d
    .prepare("SELECT month, amount FROM savings WHERE year = ? ORDER BY month")
    .all(year) as MonthlySaving[];
  const result = Array(12).fill(0);
  rows.forEach((r) => {
    result[r.month] = r.amount;
  });
  return result;
}

/** Somme cumulée de toutes les épargnes (toutes années) — pour le fonds d'urgence */
export function getTotalSavingsCumulative(): number {
  const row = getDb().prepare("SELECT COALESCE(SUM(amount), 0) as total FROM savings").get() as { total: number };
  return row?.total ?? 0;
}

export function setSaving(
  month: number,
  year: number,
  amount: number
): void {
  const d = getDb();
  d.prepare(
    "INSERT INTO savings (month, year, amount) VALUES (?, ?, ?) ON CONFLICT(month, year) DO UPDATE SET amount = excluded.amount"
  ).run(month, year, amount);
}

// ── Salaries ──

export function getSalaries(year: number): number[] {
  const d = getDb();
  const rows = d
    .prepare("SELECT month, amount FROM salaries WHERE year = ? ORDER BY month")
    .all(year) as { month: number; amount: number }[];
  const result = Array(12).fill(0);
  rows.forEach((r) => {
    result[r.month] = r.amount;
  });
  return result;
}

export function setSalary(
  month: number,
  year: number,
  amount: number
): void {
  const d = getDb();
  d.prepare(
    "INSERT INTO salaries (month, year, amount) VALUES (?, ?, ?) ON CONFLICT(month, year) DO UPDATE SET amount = excluded.amount"
  ).run(month, year, amount);
}

// ── Loans ──

export function getLoans(status?: string): Loan[] {
  const d = getDb();
  if (status) {
    return d.prepare("SELECT * FROM loans WHERE status = ? ORDER BY next_due_date ASC, created_at DESC").all(status) as Loan[];
  }
  return d.prepare("SELECT * FROM loans ORDER BY status ASC, next_due_date ASC, created_at DESC").all() as Loan[];
}

export function getLoan(id: number): Loan | null {
  return (getDb().prepare("SELECT * FROM loans WHERE id = ?").get(id) as Loan) || null;
}

export function addLoan(l: Omit<Loan, "id" | "created_at">): Loan {
  const d = getDb();
  const result = d.prepare(
    `INSERT INTO loans (type, label, lender_borrower, total_amount, remaining_amount, interest_rate, fees, monthly_payment, start_date, end_date, next_due_date, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    l.type, l.label, l.lender_borrower || "", l.total_amount, l.remaining_amount,
    l.interest_rate || 0, l.fees || 0, l.monthly_payment || 0,
    l.start_date, l.end_date || "", l.next_due_date || "", l.notes || "", l.status || "active"
  );
  return d.prepare("SELECT * FROM loans WHERE id = ?").get(result.lastInsertRowid) as Loan;
}

export function updateLoan(id: number, updates: Partial<Loan>): Loan | null {
  const d = getDb();
  const current = d.prepare("SELECT * FROM loans WHERE id = ?").get(id) as Loan | undefined;
  if (!current) return null;
  const m = { ...current, ...updates };
  d.prepare(
    `UPDATE loans SET type=?, label=?, lender_borrower=?, total_amount=?, remaining_amount=?, interest_rate=?, fees=?, monthly_payment=?, start_date=?, end_date=?, next_due_date=?, notes=?, status=? WHERE id=?`
  ).run(m.type, m.label, m.lender_borrower, m.total_amount, m.remaining_amount, m.interest_rate, m.fees, m.monthly_payment, m.start_date, m.end_date, m.next_due_date, m.notes, m.status, id);
  return d.prepare("SELECT * FROM loans WHERE id = ?").get(id) as Loan;
}

export function deleteLoan(id: number): boolean {
  return getDb().prepare("DELETE FROM loans WHERE id = ?").run(id).changes > 0;
}

// ── Loan Payments ──

export function getLoanPayments(loanId?: number, month?: number, year?: number): LoanPayment[] {
  const d = getDb();
  if (loanId) {
    return d.prepare("SELECT * FROM loan_payments WHERE loan_id = ? ORDER BY date DESC, time DESC").all(loanId) as LoanPayment[];
  }
  if (month !== undefined && year !== undefined) {
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endMonth = month === 11 ? 1 : month + 2;
    const endYear = month === 11 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
    return d.prepare("SELECT * FROM loan_payments WHERE date >= ? AND date < ? ORDER BY date DESC, time DESC").all(startDate, endDate) as LoanPayment[];
  }
  return d.prepare("SELECT * FROM loan_payments ORDER BY date DESC, time DESC").all() as LoanPayment[];
}

export function getLoanPaymentsByDateRange(start: string, end: string): LoanPayment[] {
  return getDb()
    .prepare("SELECT * FROM loan_payments WHERE date >= ? AND date <= ? ORDER BY date DESC, time DESC, id DESC")
    .all(start, end) as LoanPayment[];
}

export function addLoanPayment(p: Omit<LoanPayment, "id" | "created_at">): LoanPayment {
  const d = getDb();
  const result = d.prepare(
    "INSERT INTO loan_payments (loan_id, amount, fees, date, time, notes) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(p.loan_id, p.amount, p.fees || 0, p.date, p.time || "00:00", p.notes || "");
  const payment = d.prepare("SELECT * FROM loan_payments WHERE id = ?").get(result.lastInsertRowid) as LoanPayment;
  // Update remaining amount
  const loan = d.prepare("SELECT * FROM loans WHERE id = ?").get(p.loan_id) as Loan | undefined;
  if (loan) {
    const newRemaining = Math.max(0, loan.remaining_amount - p.amount);
    d.prepare("UPDATE loans SET remaining_amount = ?, status = ? WHERE id = ?")
      .run(newRemaining, newRemaining === 0 ? "completed" : loan.status, p.loan_id);
  }
  return payment;
}

export function addLoanPaymentsBatch(loanId: number, payments: Array<{ amount: number; fees: number; date: string; time: string; notes: string }>): number {
  const d = getDb();
  const insertStmt = d.prepare(
    "INSERT INTO loan_payments (loan_id, amount, fees, date, time, notes) VALUES (?, ?, ?, ?, ?, ?)"
  );
  let totalDeducted = 0;
  const tx = d.transaction(() => {
    for (const p of payments) {
      insertStmt.run(loanId, p.amount, p.fees || 0, p.date, p.time || "00:00", p.notes || "");
      totalDeducted += p.amount;
    }
    const loan = d.prepare("SELECT * FROM loans WHERE id = ?").get(loanId) as Loan | undefined;
    if (loan) {
      const newRemaining = Math.max(0, loan.remaining_amount - totalDeducted);
      d.prepare("UPDATE loans SET remaining_amount = ?, status = ? WHERE id = ?")
        .run(newRemaining, newRemaining === 0 ? "completed" : loan.status, loanId);
    }
  });
  tx();
  return payments.length;
}

export function updateLoanPayment(id: number, updates: Partial<Pick<LoanPayment, "amount" | "fees" | "date" | "time" | "notes">>): LoanPayment | null {
  const d = getDb();
  const current = d.prepare("SELECT * FROM loan_payments WHERE id = ?").get(id) as LoanPayment | undefined;
  if (!current) return null;
  const merged = { ...current, ...updates };
  d.prepare(
    "UPDATE loan_payments SET amount=?, fees=?, date=?, time=?, notes=? WHERE id=?"
  ).run(merged.amount, merged.fees ?? 0, merged.date, merged.time ?? "00:00", merged.notes ?? "", id);
  if (updates.amount !== undefined && updates.amount !== current.amount) {
    const loan = d.prepare("SELECT * FROM loans WHERE id = ?").get(current.loan_id) as Loan | undefined;
    if (loan) {
      const delta = current.amount - updates.amount;
      const newRemaining = Math.max(0, loan.remaining_amount + delta);
      d.prepare("UPDATE loans SET remaining_amount = ?, status = ? WHERE id = ?")
        .run(newRemaining, newRemaining === 0 ? "completed" : loan.status, current.loan_id);
    }
  }
  return d.prepare("SELECT * FROM loan_payments WHERE id = ?").get(id) as LoanPayment;
}

export function deleteLoanPayment(id: number): boolean {
  const d = getDb();
  const payment = d.prepare("SELECT * FROM loan_payments WHERE id = ?").get(id) as LoanPayment | undefined;
  if (!payment) return false;
  const deleted = d.prepare("DELETE FROM loan_payments WHERE id = ?").run(id).changes > 0;
  if (deleted) {
    const loan = d.prepare("SELECT * FROM loans WHERE id = ?").get(payment.loan_id) as Loan | undefined;
    if (loan) {
      const newRemaining = loan.remaining_amount + payment.amount;
      d.prepare("UPDATE loans SET remaining_amount = ?, status = ? WHERE id = ?")
        .run(newRemaining, "active", payment.loan_id);
    }
  }
  return deleted;
}

// ── Fixed Charge Payments ──

/**
 * Crée automatiquement les paiements des charges fixes récurrentes au 1er du mois.
 * Appelé uniquement pour le mois en cours (pas les mois passés).
 */
export function ensureRecurringPayments(month: number, year: number): number {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  if (month !== currentMonth || year !== currentYear) return 0;

  const config = getConfig();
  const existing = getFixedChargePayments(month, year);
  const existingChargeIds = new Set(existing.map((p) => p.charge_id));
  let created = 0;

  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;

  for (const ch of config.fixedCharges || []) {
    if (ch.amount <= 0) continue;
    if (existingChargeIds.has(ch.id)) continue;

    addFixedChargePayment({
      charge_id: ch.id,
      label: ch.label,
      icon: ch.icon || "house",
      amount: ch.amount,
      date: dateStr,
      time: "00:00",
      month,
      year,
      notes: "Créé automatiquement",
    });
    existingChargeIds.add(ch.id);
    created++;
  }
  return created;
}

export function getFixedChargePayments(month?: number, year?: number): FixedChargePayment[] {
  const d = getDb();
  if (month !== undefined && year !== undefined) {
    return d
      .prepare("SELECT * FROM fixed_charge_payments WHERE month = ? AND year = ? ORDER BY date DESC, time DESC, id DESC")
      .all(month, year) as FixedChargePayment[];
  }
  return d
    .prepare("SELECT * FROM fixed_charge_payments ORDER BY date DESC, time DESC, id DESC")
    .all() as FixedChargePayment[];
}

export function getFixedChargePaymentsByDateRange(start: string, end: string): FixedChargePayment[] {
  return getDb()
    .prepare("SELECT * FROM fixed_charge_payments WHERE date >= ? AND date <= ? ORDER BY date DESC, time DESC, id DESC")
    .all(start, end) as FixedChargePayment[];
}

export function addFixedChargePayment(
  p: Omit<FixedChargePayment, "id" | "created_at">
): FixedChargePayment {
  const d = getDb();
  const result = d
    .prepare(
      "INSERT INTO fixed_charge_payments (charge_id, label, icon, amount, date, time, month, year, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(p.charge_id, p.label, p.icon, p.amount, p.date, p.time || "00:00", p.month, p.year, p.notes || "");
  return d
    .prepare("SELECT * FROM fixed_charge_payments WHERE id = ?")
    .get(result.lastInsertRowid) as FixedChargePayment;
}

export function deleteFixedChargePayment(id: number): boolean {
  return getDb().prepare("DELETE FROM fixed_charge_payments WHERE id = ?").run(id).changes > 0;
}

// ── Projects ──

export function getProjects(): Project[] {
  ensureProjectFundsMigration();
  return getDb()
    .prepare("SELECT * FROM projects ORDER BY status ASC, created_at DESC")
    .all() as Project[];
}

export function addProject(
  p: Omit<Project, "id" | "created_at">
): Project {
  const d = getDb();
  const result = d
    .prepare(
      "INSERT INTO projects (name, description, target_amount, saved_amount, deadline, color, icon, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      p.name,
      p.description,
      p.target_amount,
      p.saved_amount || 0,
      p.deadline,
      p.color,
      p.icon,
      p.status || "active"
    );
  return d
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(result.lastInsertRowid) as Project;
}

export function updateProject(
  id: number,
  updates: Partial<Project>
): Project | null {
  const d = getDb();
  const current = d
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(id) as Project | undefined;
  if (!current) return null;
  const merged = { ...current, ...updates };
  d.prepare(
    "UPDATE projects SET name=?, description=?, target_amount=?, saved_amount=?, deadline=?, color=?, icon=?, status=? WHERE id=?"
  ).run(
    merged.name,
    merged.description,
    merged.target_amount,
    merged.saved_amount,
    merged.deadline,
    merged.color,
    merged.icon,
    merged.status,
    id
  );
  return d.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Project;
}

export function deleteProject(id: number): boolean {
  const d = getDb();
  const purchases = d.prepare("SELECT expense_id FROM project_purchases WHERE project_id = ? AND expense_id IS NOT NULL").all(id) as { expense_id: number }[];
  for (const { expense_id } of purchases) {
    d.prepare("DELETE FROM expenses WHERE id = ?").run(expense_id);
  }
  return d.prepare("DELETE FROM projects WHERE id = ?").run(id).changes > 0;
}

export function getProject(id: number): Project | null {
  const row = getDb().prepare("SELECT * FROM projects WHERE id = ?").get(id);
  return (row as Project) || null;
}

// ── Project Funds ──

export function getProjectFunds(projectId: number): ProjectFund[] {
  return getDb()
    .prepare("SELECT * FROM project_funds WHERE project_id = ? ORDER BY date DESC, created_at DESC")
    .all(projectId) as ProjectFund[];
}

export function addProjectFund(f: Omit<ProjectFund, "id" | "created_at"> & { income_id?: number | null }): ProjectFund {
  const d = getDb();
  const result = d
    .prepare("INSERT INTO project_funds (project_id, amount, date, notes, income_id) VALUES (?, ?, ?, ?, ?)")
    .run(f.project_id, f.amount, f.date, f.notes || "", f.income_id ?? null);
  const fund = d.prepare("SELECT * FROM project_funds WHERE id = ?").get(result.lastInsertRowid) as ProjectFund;
  syncProjectSavedAmount(f.project_id);
  return fund;
}

export function updateProjectFund(id: number, updates: { amount?: number; date?: string; notes?: string }): ProjectFund | null {
  const d = getDb();
  const current = d.prepare("SELECT * FROM project_funds WHERE id = ?").get(id) as (ProjectFund & { income_id?: number | null }) | undefined;
  if (!current) return null;
  const m = { ...current, ...updates };
  d.prepare("UPDATE project_funds SET amount=?, date=?, notes=? WHERE id=?")
    .run(m.amount, m.date, m.notes || "", id);
  if (current.income_id && (updates.amount !== undefined || updates.date !== undefined)) {
    const inc = d.prepare("SELECT * FROM incomes WHERE id = ?").get(current.income_id) as { amount: number; date: string } | undefined;
    if (inc) {
      d.prepare("UPDATE incomes SET amount=?, date=? WHERE id=?")
        .run(updates.amount ?? inc.amount, updates.date ?? inc.date, current.income_id);
    }
  }
  syncProjectSavedAmount(current.project_id);
  return d.prepare("SELECT * FROM project_funds WHERE id = ?").get(id) as ProjectFund;
}

export function deleteProjectFund(id: number): boolean {
  const d = getDb();
  const fund = d.prepare("SELECT * FROM project_funds WHERE id = ?").get(id) as (ProjectFund & { income_id?: number | null }) | undefined;
  if (!fund) return false;
  if (fund.income_id) {
    d.prepare("DELETE FROM incomes WHERE id = ?").run(fund.income_id);
  }
  const ok = d.prepare("DELETE FROM project_funds WHERE id = ?").run(id).changes > 0;
  if (ok) syncProjectSavedAmount(fund.project_id);
  return ok;
}

function syncProjectSavedAmount(projectId: number): void {
  const d = getDb();
  const fundsRow = d.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM project_funds WHERE project_id = ?").get(projectId) as { total: number };
  const spentRow = d.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM project_purchases WHERE project_id = ?").get(projectId) as { total: number };
  const remaining = Math.max(0, (fundsRow?.total ?? 0) - (spentRow?.total ?? 0));
  d.prepare("UPDATE projects SET saved_amount = ? WHERE id = ?").run(remaining, projectId);
}

/** Somme des fonds projet ajoutés sur un mois (prélèvement du solde, comme l'épargne) */
export function getProjectFundsSumForMonth(month: number, year: number): number {
  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const row = getDb()
    .prepare("SELECT COALESCE(SUM(amount), 0) as total FROM project_funds WHERE date >= ? AND date <= ?")
    .get(startDate, endDate) as { total: number };
  return row?.total ?? 0;
}

/** Migration: pour les projets existants avec saved_amount > 0 mais sans fonds, crée une entrée initiale */
export function migrateProjectFundsIfNeeded(): void {
  const d = getDb();
  const projects = d.prepare("SELECT id, saved_amount FROM projects WHERE saved_amount > 0").all() as { id: number; saved_amount: number }[];
  for (const p of projects) {
    const count = d.prepare("SELECT COUNT(*) as c FROM project_funds WHERE project_id = ?").get(p.id) as { c: number };
    if (count.c === 0) {
      d.prepare("INSERT INTO project_funds (project_id, amount, date, notes) VALUES (?, ?, date('now'), 'Migration')")
        .run(p.id, p.saved_amount);
    }
  }
}

// ── Project Purchases (achats liés aux projets réalisés) ──

export function getProjectPurchases(projectId: number): ProjectPurchase[] {
  return getDb()
    .prepare("SELECT * FROM project_purchases WHERE project_id = ? ORDER BY date DESC, created_at DESC")
    .all(projectId) as ProjectPurchase[];
}

export function addProjectPurchase(p: Omit<ProjectPurchase, "id" | "created_at">): ProjectPurchase {
  const d = getDb();
  const result = d
    .prepare(
      "INSERT INTO project_purchases (project_id, description, amount, date, expense_id) VALUES (?, ?, ?, ?, ?)"
    )
    .run(p.project_id, p.description, p.amount, p.date, p.expense_id ?? null);
  syncProjectSavedAmount(p.project_id);
  return d.prepare("SELECT * FROM project_purchases WHERE id = ?").get(result.lastInsertRowid) as ProjectPurchase;
}

export function deleteProjectPurchase(id: number): boolean {
  const d = getDb();
  const purchase = d.prepare("SELECT project_id FROM project_purchases WHERE id = ?").get(id) as { project_id: number } | undefined;
  const ok = d.prepare("DELETE FROM project_purchases WHERE id = ?").run(id).changes > 0;
  if (ok && purchase) syncProjectSavedAmount(purchase.project_id);
  return ok;
}

// ── Planned Expenses ──

export function getPlannedExpenses(status?: string): PlannedExpense[] {
  const d = getDb();
  if (status) {
    return d.prepare("SELECT * FROM planned_expenses WHERE status = ? ORDER BY due_date ASC").all(status) as PlannedExpense[];
  }
  return d.prepare("SELECT * FROM planned_expenses ORDER BY due_date ASC").all() as PlannedExpense[];
}

export function addPlannedExpense(p: Omit<PlannedExpense, "id" | "created_at" | "expense_id">): PlannedExpense {
  const d = getDb();
  const result = d.prepare(
    "INSERT INTO planned_expenses (due_date, description, category, amount, notes, status) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(p.due_date, p.description, p.category, p.amount, p.notes || "", p.status || "pending");
  return d.prepare("SELECT * FROM planned_expenses WHERE id = ?").get(result.lastInsertRowid) as PlannedExpense;
}

export function updatePlannedExpense(id: number, updates: Partial<PlannedExpense>): PlannedExpense | null {
  const d = getDb();
  const current = d.prepare("SELECT * FROM planned_expenses WHERE id = ?").get(id) as PlannedExpense | undefined;
  if (!current) return null;
  const merged = { ...current, ...updates };
  d.prepare(
    "UPDATE planned_expenses SET due_date=?, description=?, category=?, amount=?, notes=? WHERE id=?"
  ).run(merged.due_date, merged.description, merged.category, merged.amount, merged.notes || "", id);
  return d.prepare("SELECT * FROM planned_expenses WHERE id = ?").get(id) as PlannedExpense;
}

export function executePlannedExpenseById(id: number): Expense | null {
  const d = getDb();
  const p = d.prepare("SELECT * FROM planned_expenses WHERE id = ? AND status = 'pending'").get(id) as PlannedExpense | undefined;
  if (!p) return null;
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const result = d.prepare(
    "INSERT INTO expenses (date, time, description, category, amount, notes) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(today, time, p.description, p.category, p.amount, p.notes ? `[Planifié] ${p.notes}` : "[Planifié]");
  d.prepare("UPDATE planned_expenses SET status = 'executed', expense_id = ? WHERE id = ?").run(result.lastInsertRowid, id);
  return d.prepare("SELECT * FROM expenses WHERE id = ?").get(result.lastInsertRowid) as Expense;
}

export function deletePlannedExpense(id: number): boolean {
  const d = getDb();
  const p = d.prepare("SELECT * FROM planned_expenses WHERE id = ?").get(id) as PlannedExpense | undefined;
  if (!p) return false;
  if (p.status === "executed" && p.expense_id) {
    d.prepare("DELETE FROM expenses WHERE id = ?").run(p.expense_id);
  }
  return d.prepare("DELETE FROM planned_expenses WHERE id = ?").run(id).changes > 0;
}

export function executeDuePlannedExpenses(): { executed: number; ids: number[] } {
  const d = getDb();
  const today = new Date().toISOString().split("T")[0];
  const due = d.prepare(
    "SELECT * FROM planned_expenses WHERE status = 'pending' AND due_date <= ?"
  ).all(today) as PlannedExpense[];

  const executedIds: number[] = [];
  const insertExp = d.prepare(
    "INSERT INTO expenses (date, time, description, category, amount, notes) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const updatePlanned = d.prepare(
    "UPDATE planned_expenses SET status = 'executed', expense_id = ? WHERE id = ?"
  );

  const tx = d.transaction(() => {
    for (const p of due) {
      const result = insertExp.run(p.due_date, "00:00", p.description, p.category, p.amount, p.notes ? `[Planifié] ${p.notes}` : "[Planifié]");
      updatePlanned.run(result.lastInsertRowid, p.id);
      executedIds.push(p.id);
    }
  });
  tx();
  return { executed: executedIds.length, ids: executedIds };
}

// ── Users ──

export interface UserRow {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  password_hash: string;
  avatar_path: string | null;
  created_at: string;
}

export function getUserByEmail(email: string): UserRow | null {
  return (getDb().prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow) || null;
}

export function getUserByPhone(phone: string): UserRow | null {
  return (getDb().prepare("SELECT * FROM users WHERE phone = ?").get(phone) as UserRow) || null;
}

export function getUserById(id: number): UserRow | null {
  return (getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow) || null;
}

export function createUser(u: { first_name: string; last_name: string; phone: string; email: string; password_hash: string }): UserRow {
  const d = getDb();
  const result = d.prepare(
    "INSERT INTO users (first_name, last_name, phone, email, password_hash) VALUES (?, ?, ?, ?, ?)"
  ).run(u.first_name, u.last_name, u.phone, u.email, u.password_hash);
  return d.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid) as UserRow;
}

export function updateUserPassword(id: number, newHash: string): boolean {
  return getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, id).changes > 0;
}

export function updateUserAvatar(id: number, avatarPath: string | null): boolean {
  return getDb().prepare("UPDATE users SET avatar_path = ? WHERE id = ?").run(avatarPath, id).changes > 0;
}

// ── Backup & Restore ──

export interface BackupData {
  version: number;
  exportedAt: string;
  data: {
    expenses: Expense[];
    incomes: Income[];
    config: BudgetConfig;
    savings: Array<{ id?: number; month: number; year: number; amount: number }>;
    salaries: Array<{ id?: number; month: number; year: number; amount: number }>;
    projects: Project[];
    fixed_charge_payments: FixedChargePayment[];
    loans: Loan[];
    loan_payments: LoanPayment[];
    planned_expenses: PlannedExpense[];
  };
}

export function exportBackup(): BackupData {
  const d = getDb();
  const expenses = d.prepare("SELECT * FROM expenses ORDER BY id").all() as Expense[];
  const incomes = d.prepare("SELECT * FROM incomes ORDER BY id").all() as Income[];
  const config = getConfig();
  const savings = d.prepare("SELECT * FROM savings ORDER BY year, month").all() as Array<{ id?: number; month: number; year: number; amount: number }>;
  const salaries = d.prepare("SELECT * FROM salaries ORDER BY year, month").all() as Array<{ id?: number; month: number; year: number; amount: number }>;
  const projects = d.prepare("SELECT * FROM projects ORDER BY id").all() as Project[];
  const fixed_charge_payments = d.prepare("SELECT * FROM fixed_charge_payments ORDER BY id").all() as FixedChargePayment[];
  const loans = d.prepare("SELECT * FROM loans ORDER BY id").all() as Loan[];
  const loan_payments = d.prepare("SELECT * FROM loan_payments ORDER BY id").all() as LoanPayment[];
  const planned_expenses = d.prepare("SELECT * FROM planned_expenses ORDER BY id").all() as PlannedExpense[];

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      expenses,
      incomes,
      config,
      savings,
      salaries,
      projects,
      fixed_charge_payments,
      loans,
      loan_payments,
      planned_expenses,
    },
  };
}

export function importBackup(backup: BackupData): { success: boolean; error?: string } {
  const d = getDb();
  const data = backup?.data;
  if (!data || typeof data !== "object") {
    return { success: false, error: "Format de sauvegarde invalide" };
  }

  const tx = d.transaction(() => {
    d.pragma("foreign_keys = OFF");

    d.prepare("DELETE FROM loan_payments").run();
    d.prepare("DELETE FROM loans").run();
    d.prepare("DELETE FROM fixed_charge_payments").run();
    d.prepare("DELETE FROM planned_expenses").run();
    d.prepare("DELETE FROM expenses").run();
    d.prepare("DELETE FROM incomes").run();
    d.prepare("DELETE FROM savings").run();
    d.prepare("DELETE FROM salaries").run();
    d.prepare("DELETE FROM projects").run();
    d.prepare("DELETE FROM config").run();

    if (data.config) {
      d.prepare("INSERT INTO config (id, data) VALUES (1, ?)").run(JSON.stringify(data.config));
    }

    const insExp = d.prepare(
      "INSERT INTO expenses (id, date, time, description, category, amount, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const e of data.expenses || []) {
      insExp.run(e.id, e.date, e.time || "00:00", e.description, e.category, e.amount, e.notes || "", e.created_at || new Date().toISOString());
    }

    const insInc = d.prepare(
      "INSERT INTO incomes (id, date, time, description, source, amount, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const i of data.incomes || []) {
      insInc.run(i.id, i.date, i.time || "00:00", i.description, i.source || "other", i.amount, i.notes || "", i.created_at || new Date().toISOString());
    }

    const insSav = d.prepare("INSERT INTO savings (month, year, amount) VALUES (?, ?, ?)");
    for (const s of data.savings || []) {
      insSav.run(s.month, s.year, s.amount ?? 0);
    }

    const insSal = d.prepare("INSERT INTO salaries (month, year, amount) VALUES (?, ?, ?)");
    for (const s of data.salaries || []) {
      insSal.run(s.month, s.year, s.amount ?? 0);
    }

    const insProj = d.prepare(
      "INSERT INTO projects (id, name, description, target_amount, saved_amount, deadline, color, icon, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const p of data.projects || []) {
      insProj.run(p.id, p.name, p.description || "", p.target_amount, p.saved_amount ?? 0, p.deadline || "", p.color || "#6366f1", p.icon || "target", p.status || "active", p.created_at || new Date().toISOString());
    }

    const insLoan = d.prepare(
      "INSERT INTO loans (id, type, label, lender_borrower, total_amount, remaining_amount, interest_rate, fees, monthly_payment, start_date, end_date, next_due_date, notes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const l of data.loans || []) {
      insLoan.run(l.id, l.type, l.label, l.lender_borrower || "", l.total_amount, l.remaining_amount ?? 0, l.interest_rate ?? 0, l.fees ?? 0, l.monthly_payment ?? 0, l.start_date, l.end_date || "", l.next_due_date || "", l.notes || "", l.status || "active", l.created_at || new Date().toISOString());
    }

    const insLoanPay = d.prepare(
      "INSERT INTO loan_payments (id, loan_id, amount, fees, date, time, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const lp of data.loan_payments || []) {
      insLoanPay.run(lp.id, lp.loan_id, lp.amount, lp.fees ?? 0, lp.date, lp.time || "00:00", lp.notes || "", lp.created_at || new Date().toISOString());
    }

    const insFcp = d.prepare(
      "INSERT INTO fixed_charge_payments (id, charge_id, label, icon, amount, date, time, month, year, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const f of data.fixed_charge_payments || []) {
      insFcp.run(f.id, f.charge_id, f.label, f.icon || "house", f.amount, f.date, f.time || "00:00", f.month, f.year, f.notes || "", f.created_at || new Date().toISOString());
    }

    const insPlanned = d.prepare(
      "INSERT INTO planned_expenses (id, due_date, description, category, amount, notes, status, expense_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const pe of data.planned_expenses || []) {
      insPlanned.run(pe.id, pe.due_date, pe.description, pe.category, pe.amount, pe.notes || "", pe.status || "pending", pe.expense_id ?? null, pe.created_at || new Date().toISOString());
    }

    d.pragma("foreign_keys = ON");
  });

  try {
    tx();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur lors de la restauration" };
  }
}

const BACKUP_DIR = path.join(process.cwd(), "data", "backups");
const LAST_BACKUP_FILE = path.join(process.cwd(), "data", "last_auto_backup.txt");

export function ensureDailyBackup(): string | null {
  const dir = path.dirname(BACKUP_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  const backupPath = path.join(BACKUP_DIR, `backup-${today}.json`);

  if (fs.existsSync(backupPath)) return backupPath;

  try {
    const backup = exportBackup();
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), "utf-8");
    fs.writeFileSync(LAST_BACKUP_FILE, today, "utf-8");
    return backupPath;
  } catch {
    return null;
  }
}

export function getAutoBackupList(): Array<{ date: string; path: string }> {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith("backup-") && f.endsWith(".json"));
  return files
    .map((f) => {
      const m = f.match(/backup-(\d{4}-\d{2}-\d{2})\.json/);
      return m ? { date: m[1], path: path.join(BACKUP_DIR, f) } : null;
    })
    .filter((x): x is { date: string; path: string } => x !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
}
