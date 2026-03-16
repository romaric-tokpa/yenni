import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { Expense, Income, Project, BudgetConfig, MonthlySaving, FixedChargePayment, Loan, LoanPayment, PlannedExpense } from "./types";
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

  return db;
}

// ── Expenses ──

export function getExpenses(month?: number, year?: number): Expense[] {
  const d = getDb();
  if (month !== undefined && year !== undefined) {
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endMonth = month === 11 ? 1 : month + 2;
    const endYear = month === 11 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
    return d
      .prepare(
        "SELECT * FROM expenses WHERE date >= ? AND date < ? ORDER BY date DESC, time DESC, id DESC"
      )
      .all(startDate, endDate) as Expense[];
  }
  return d
    .prepare("SELECT * FROM expenses ORDER BY date DESC, time DESC, id DESC")
    .all() as Expense[];
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

export function deleteExpense(id: number): boolean {
  return getDb().prepare("DELETE FROM expenses WHERE id = ?").run(id).changes > 0;
}

export function getExpensesByDateRange(
  start: string,
  end: string
): Expense[] {
  return getDb()
    .prepare(
      "SELECT * FROM expenses WHERE date >= ? AND date <= ? ORDER BY date DESC, time DESC"
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
    .prepare("SELECT * FROM incomes WHERE date >= ? AND date <= ? ORDER BY date DESC, time DESC")
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
    .prepare("SELECT * FROM loan_payments WHERE date >= ? AND date <= ? ORDER BY date DESC, time DESC")
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

export function deleteLoanPayment(id: number): boolean {
  const d = getDb();
  const payment = d.prepare("SELECT * FROM loan_payments WHERE id = ?").get(id) as LoanPayment | undefined;
  if (!payment) return false;
  const deleted = d.prepare("DELETE FROM loan_payments WHERE id = ?").run(id).changes > 0;
  if (deleted) {
    const loan = d.prepare("SELECT * FROM loans WHERE id = ?").get(payment.loan_id) as Loan | undefined;
    if (loan) {
      d.prepare("UPDATE loans SET remaining_amount = remaining_amount + ?, status = 'active' WHERE id = ?")
        .run(payment.amount, payment.loan_id);
    }
  }
  return deleted;
}

// ── Fixed Charge Payments ──

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
    .prepare("SELECT * FROM fixed_charge_payments WHERE date >= ? AND date <= ? ORDER BY date DESC, time DESC")
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
  return getDb().prepare("DELETE FROM projects WHERE id = ?").run(id).changes > 0;
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
  return getDb().prepare("DELETE FROM planned_expenses WHERE id = ?").run(id).changes > 0;
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
