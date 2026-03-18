import path from "path";
import fs from "fs";
import type { InStatement } from "@libsql/client";
import { getDbClient, isTurso } from "./db/client";
import { Expense, Income, Project, ProjectFund, ProjectPurchase, BudgetConfig, MonthlySaving, FixedChargePayment, Loan, LoanPayment, PlannedExpense, LoanScheduleRow, LoanScheduleInput, Wish } from "./types";
import { DEFAULT_CONFIG } from "./constants";

// ── Helpers ──

type Row = Record<string, unknown>;

function rowToObj<T>(row: Row, columns: string[]): T {
  const obj: Record<string, unknown> = {};
  for (const col of columns) {
    obj[col] = row[col];
  }
  return obj as T;
}

function rowsToObjs<T>(rows: Row[], columns: string[]): T[] {
  return rows.map((r) => rowToObj<T>(r, columns));
}

// ── Migrations ──

const MIGRATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;

async function runMigrations(): Promise<void> {
  const db = getDbClient();

  for (const v of MIGRATIONS) {
    const rs = await db.execute({
      sql: "SELECT 1 FROM schema_migrations WHERE version = ?",
      args: [v],
    });
    if (rs.rows.length > 0) continue;

    const migrationPath = path.join(process.cwd(), "src", "lib", "db", "migrations", `${String(v).padStart(3, "0")}_*.sql`);
    const files = fs.readdirSync(path.join(process.cwd(), "src", "lib", "db", "migrations"));
    const file = files.find((f) => f.startsWith(`${String(v).padStart(3, "0")}_`));
    if (!file) continue;

    const sql = fs.readFileSync(path.join(process.cwd(), "src", "lib", "db", "migrations", file), "utf-8");
    const statements = sql
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n")
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      try {
        await db.execute({ sql: stmt });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("duplicate column name")) continue;
        throw e;
      }
    }

    try {
      await db.execute({
        sql: "INSERT INTO schema_migrations (version) VALUES (?)",
        args: [v],
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const causeMsg = e instanceof Error && e.cause instanceof Error ? e.cause.message : "";
      if (msg.includes("UNIQUE constraint") || causeMsg.includes("UNIQUE constraint")) continue;
      throw e;
    }
  }
}

let migrationsRun = false;
let migrationsPromise: Promise<void> | null = null;

async function ensureMigrations(): Promise<void> {
  if (migrationsRun) return;
  if (migrationsPromise) {
    await migrationsPromise;
    return;
  }
  migrationsPromise = (async () => {
    const db = getDbClient();
    const initSql = fs.readFileSync(path.join(process.cwd(), "src", "lib", "db", "migrations", "001_initial.sql"), "utf-8");
    const statements = initSql
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n")
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      await db.execute({ sql: stmt });
    }
    await runMigrations();
    await ensureLogoSvg();
    migrationsRun = true;
  })();
  await migrationsPromise;
}

// ── App settings (logo lié à Turso) ──

const DEFAULT_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="45" fill="none" stroke="#008080" stroke-width="6"/><ellipse cx="58" cy="62" rx="18" ry="8" fill="#FFA500"/><ellipse cx="50" cy="52" rx="18" ry="8" fill="#FFA500"/><ellipse cx="42" cy="42" rx="18" ry="8" fill="#FFA500"/></svg>`;

export async function getLogoSvg(): Promise<string> {
  await ensureMigrations();
  const db = getDbClient();
  try {
    const rs = await db.execute({
      sql: "SELECT value FROM app_settings WHERE key = ?",
      args: ["logo_svg"],
    });
    if (rs.rows.length > 0 && rs.rows[0]) {
      const val = (rs.rows[0] as Row).value;
      if (typeof val === "string" && val.length > 0) return val;
    }
  } catch {
    /* table may not exist yet */
  }
  return DEFAULT_LOGO_SVG;
}

export async function saveLogoSvg(svg: string): Promise<void> {
  await ensureMigrations();
  await getDbClient().execute({
    sql: "INSERT INTO app_settings (key, value) VALUES ('logo_svg', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [svg],
  });
}

async function ensureLogoSvg(): Promise<void> {
  const db = getDbClient();
  try {
    const rs = await db.execute({
      sql: "SELECT 1 FROM app_settings WHERE key = 'logo_svg'",
    });
    if (rs.rows.length === 0) {
      await db.execute({
        sql: "INSERT INTO app_settings (key, value) VALUES ('logo_svg', ?)",
        args: [DEFAULT_LOGO_SVG],
      });
    }
  } catch {
    /* ignore */
  }
}

// ── Project funds migration (données existantes) ──

let projectFundsMigrationDone = false;

async function ensureProjectFundsMigration(): Promise<void> {
  if (projectFundsMigrationDone) return;
  projectFundsMigrationDone = true;
  try {
    await migrateProjectFundsIfNeeded();
  } catch {
    /* ignore */
  }
}

// ── Expenses ──

export async function getExpenses(month?: number, year?: number, limit?: number, offset?: number): Promise<Expense[]> {
  await ensureMigrations();
  const db = getDbClient();
  let sql: string;
  let args: (string | number)[];
  if (month !== undefined && year !== undefined) {
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endMonth = month === 11 ? 1 : month + 2;
    const endYear = month === 11 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
    sql = "SELECT * FROM expenses WHERE date >= ? AND date < ? ORDER BY date DESC, time DESC, id DESC";
    args = [startDate, endDate];
  } else {
    sql = "SELECT * FROM expenses ORDER BY date DESC, time DESC, id DESC";
    args = [];
  }
  if (limit !== undefined && limit > 0) {
    sql += " LIMIT ?";
    args.push(limit);
    if (offset !== undefined && offset > 0) {
      sql += " OFFSET ?";
      args.push(offset);
    }
  }
  const rs = await db.execute({ sql, args });
  return rowsToObjs<Expense>(rs.rows as Row[], rs.columns);
}

export async function addExpense(exp: Omit<Expense, "id" | "created_at">, userId: number): Promise<Expense> {
  await ensureMigrations();
  const db = getDbClient();
  const rs = await db.execute({
    sql: "INSERT INTO expenses (user_id, date, time, description, category, amount, notes) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
    args: [userId, exp.date, exp.time || "00:00", exp.description, exp.category, exp.amount, exp.notes || ""],
  });
  return rowToObj<Expense>(rs.rows[0] as Row, rs.columns);
}

export async function updateExpense(id: number, updates: Partial<Omit<Expense, "id" | "created_at">>): Promise<Expense | null> {
  await ensureMigrations();
  const db = getDbClient();
  const currentRs = await db.execute({ sql: "SELECT * FROM expenses WHERE id = ?", args: [id] });
  if (currentRs.rows.length === 0) return null;
  const current = rowToObj<Expense>(currentRs.rows[0] as Row, currentRs.columns);
  const m = {
    date: updates.date ?? current.date,
    time: updates.time ?? current.time ?? "00:00",
    description: updates.description ?? current.description,
    category: updates.category ?? current.category,
    amount: updates.amount ?? current.amount,
    notes: updates.notes ?? current.notes,
  };
  await db.execute({
    sql: "UPDATE expenses SET date=?, time=?, description=?, category=?, amount=?, notes=? WHERE id=?",
    args: [m.date, m.time, m.description, m.category, m.amount, m.notes ?? "", id],
  });
  const rs = await db.execute({ sql: "SELECT * FROM expenses WHERE id = ?", args: [id] });
  return rowToObj<Expense>(rs.rows[0] as Row, rs.columns);
}

export async function deleteExpense(id: number): Promise<boolean> {
  await ensureMigrations();
  const db = getDbClient();
  const linkedSchedule = await getScheduleByExpenseId(id);
  if (linkedSchedule) {
    const unpaid = await markScheduleUnpaid(linkedSchedule.loan_id, linkedSchedule.number);
    return unpaid !== null;
  }
  const linkedPayment = await getPaymentByExpenseId(id);
  if (linkedPayment) {
    return await deleteLoanPayment(linkedPayment.id);
  }
  await db.execute({ sql: "UPDATE planned_expenses SET expense_id = NULL, status = 'cancelled' WHERE expense_id = ?", args: [id] });
  await db.execute({ sql: "UPDATE wishes SET expense_id = NULL WHERE expense_id = ?", args: [id] });
  const rs = await db.execute({ sql: "DELETE FROM expenses WHERE id = ?", args: [id] });
  return (rs.rowsAffected ?? 0) > 0;
}

export async function getExpensesByDateRange(start: string, end: string): Promise<Expense[]> {
  await ensureMigrations();
  const db = getDbClient();
  const rs = await db.execute({
    sql: "SELECT * FROM expenses WHERE date >= ? AND date <= ? ORDER BY date DESC, time DESC, id DESC",
    args: [start, end],
  });
  return rowsToObjs<Expense>(rs.rows as Row[], rs.columns);
}

// ── Incomes ──

export async function getIncomes(month?: number, year?: number): Promise<Income[]> {
  await ensureMigrations();
  const db = getDbClient();
  if (month !== undefined && year !== undefined) {
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endMonth = month === 11 ? 1 : month + 2;
    const endYear = month === 11 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
    const rs = await db.execute({
      sql: "SELECT * FROM incomes WHERE date >= ? AND date < ? ORDER BY date DESC, time DESC, id DESC",
      args: [startDate, endDate],
    });
    return rowsToObjs<Income>(rs.rows as Row[], rs.columns);
  }
  const rs = await db.execute("SELECT * FROM incomes ORDER BY date DESC, time DESC, id DESC");
  return rowsToObjs<Income>(rs.rows as Row[], rs.columns);
}

export async function addIncome(inc: Omit<Income, "id" | "created_at">): Promise<Income> {
  await ensureMigrations();
  const db = getDbClient();
  const rs = await db.execute({
    sql: "INSERT INTO incomes (date, time, description, source, amount, notes) VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
    args: [inc.date, inc.time || "00:00", inc.description, inc.source || "other", inc.amount, inc.notes || ""],
  });
  return rowToObj<Income>(rs.rows[0] as Row, rs.columns);
}

export async function deleteIncome(id: number): Promise<boolean> {
  await ensureMigrations();
  const linkedPayment = await getPaymentByIncomeId(id);
  if (linkedPayment) {
    return await deleteLoanPayment(linkedPayment.id);
  }
  const rs = await getDbClient().execute({ sql: "DELETE FROM incomes WHERE id = ?", args: [id] });
  return (rs.rowsAffected ?? 0) > 0;
}

export async function getIncomesByDateRange(start: string, end: string): Promise<Income[]> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "SELECT * FROM incomes WHERE date >= ? AND date <= ? ORDER BY date DESC, time DESC, id DESC",
    args: [start, end],
  });
  return rowsToObjs<Income>(rs.rows as Row[], rs.columns);
}

// ── Config ──

export async function getConfig(): Promise<BudgetConfig> {
  await ensureMigrations();
  const rs = await getDbClient().execute("SELECT data FROM config WHERE id = 1");
  if (rs.rows.length > 0) {
    try {
      const saved = JSON.parse((rs.rows[0] as Row).data as string) as BudgetConfig;
      const mergedCategories = [...(saved.categories || [])];
      for (const dc of DEFAULT_CONFIG.categories) {
        if (!mergedCategories.some((c) => c.id === dc.id)) {
          mergedCategories.push(dc);
        }
      }
      const wishCategories = Array.isArray(saved.wishCategories) ? saved.wishCategories : [];
      return { ...saved, categories: mergedCategories, wishCategories };
    } catch {
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}

export async function saveConfig(config: BudgetConfig): Promise<void> {
  await ensureMigrations();
  await getDbClient().execute({
    sql: "INSERT INTO config (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
    args: [JSON.stringify(config)],
  });
}

// ── Savings ──

export async function getSavings(year: number): Promise<number[]> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "SELECT month, amount FROM savings WHERE year = ? ORDER BY month",
    args: [year],
  });
  const rows = rowsToObjs<MonthlySaving>(rs.rows as Row[], rs.columns);
  const result = Array(12).fill(0);
  rows.forEach((r) => {
    result[r.month] = r.amount;
  });
  return result;
}

export async function getTotalSavingsCumulative(): Promise<number> {
  await ensureMigrations();
  const rs = await getDbClient().execute("SELECT COALESCE(SUM(amount), 0) as total FROM savings");
  return Number((rs.rows[0] as Row)?.total ?? 0);
}

/** Somme des épargnes dans la période [startDate, endDate] (inclusif). */
export async function getSavingsInPeriod(startDate: string, endDate: string): Promise<number> {
  await ensureMigrations();
  const [sy, sm] = startDate.split("-").map(Number);
  const [ey, em] = endDate.split("-").map(Number);
  const startVal = sy * 12 + (sm - 1); // month 1-12 → 0-11
  const endVal = ey * 12 + (em - 1);
  const rs = await getDbClient().execute({
    sql: `SELECT COALESCE(SUM(amount), 0) as total FROM savings 
          WHERE (year * 12 + month) BETWEEN ? AND ?`,
    args: [startVal, endVal],
  });
  return Number((rs.rows[0] as Row)?.total ?? 0);
}

export async function setSaving(month: number, year: number, amount: number): Promise<void> {
  await ensureMigrations();
  await getDbClient().execute({
    sql: "INSERT INTO savings (month, year, amount) VALUES (?, ?, ?) ON CONFLICT(month, year) DO UPDATE SET amount = excluded.amount",
    args: [month, year, amount],
  });
}

// ── Salaries ──

export async function getSalaries(year: number): Promise<number[]> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "SELECT month, amount FROM salaries WHERE year = ? ORDER BY month",
    args: [year],
  });
  const rows = rowsToObjs<{ month: number; amount: number }>(rs.rows as Row[], rs.columns);
  const result = Array(12).fill(0);
  rows.forEach((r) => {
    result[r.month] = r.amount;
  });
  return result;
}

export async function setSalary(month: number, year: number, amount: number): Promise<void> {
  await ensureMigrations();
  await getDbClient().execute({
    sql: "INSERT INTO salaries (month, year, amount) VALUES (?, ?, ?) ON CONFLICT(month, year) DO UPDATE SET amount = excluded.amount",
    args: [month, year, amount],
  });
}

// ── Other Incomes ──

export async function getOtherIncomes(year: number): Promise<number[]> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "SELECT month, amount FROM other_incomes WHERE year = ? ORDER BY month",
    args: [year],
  });
  const rows = rowsToObjs<{ month: number; amount: number }>(rs.rows as Row[], rs.columns);
  const result = Array(12).fill(0);
  rows.forEach((r) => {
    result[r.month] = r.amount;
  });
  return result;
}

export async function setOtherIncome(month: number, year: number, amount: number): Promise<void> {
  await ensureMigrations();
  await getDbClient().execute({
    sql: "INSERT INTO other_incomes (month, year, amount) VALUES (?, ?, ?) ON CONFLICT(month, year) DO UPDATE SET amount = excluded.amount",
    args: [month, year, amount],
  });
}

// ── Category budgets (par mois) ──

/** Retourne les budgets par catégorie pour un mois donné. Seules les entrées explicites sont retournées. */
export async function getCategoryBudgets(month: number, year: number): Promise<Record<string, number>> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "SELECT category_id, amount FROM category_budgets WHERE month = ? AND year = ?",
    args: [month, year],
  });
  const result: Record<string, number> = {};
  for (const row of rs.rows) {
    const r = row as Row;
    result[r.category_id as string] = Number(r.amount ?? 0);
  }
  return result;
}

export async function setCategoryBudget(month: number, year: number, categoryId: string, amount: number): Promise<void> {
  await ensureMigrations();
  await getDbClient().execute({
    sql: `INSERT INTO category_budgets (month, year, category_id, amount) VALUES (?, ?, ?, ?)
          ON CONFLICT(month, year, category_id) DO UPDATE SET amount = excluded.amount`,
    args: [month, year, categoryId, Math.max(0, amount)],
  });
}

// ── Loans ──

export async function getLoans(status?: string): Promise<Loan[]> {
  await ensureMigrations();
  const db = getDbClient();
  let rs;
  if (status) {
    rs = await db.execute({
      sql: "SELECT * FROM loans WHERE status = ? ORDER BY next_due_date ASC, created_at DESC",
      args: [status],
    });
  } else {
    rs = await db.execute("SELECT * FROM loans ORDER BY status ASC, next_due_date ASC, created_at DESC");
  }
  return rowsToObjs<Loan>(rs.rows as Row[], rs.columns);
}

export async function getLoan(id: number): Promise<Loan | null> {
  await ensureMigrations();
  const rs = await getDbClient().execute({ sql: "SELECT * FROM loans WHERE id = ?", args: [id] });
  return rs.rows.length > 0 ? (rowToObj<Loan>(rs.rows[0] as Row, rs.columns) as Loan) : null;
}

export async function addLoan(l: Omit<Loan, "id" | "created_at">): Promise<Loan> {
  await ensureMigrations();
  const db = getDbClient();
  const rs = await db.execute({
    sql: `INSERT INTO loans (type, label, lender_borrower, total_amount, remaining_amount, interest_rate, fees, monthly_payment, start_date, end_date, next_due_date, notes, status, bank_name, agency, loan_number, first_payment_date, payment_day, total_payments, paid_payments, insurance_rate, tax_rate, fees_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    args: [
      l.type,
      l.label,
      l.lender_borrower || "",
      l.total_amount,
      l.remaining_amount,
      l.interest_rate || 0,
      l.fees || 0,
      l.monthly_payment || 0,
      l.start_date,
      l.end_date || "",
      l.next_due_date || "",
      l.notes || "",
      l.status || "active",
      l.bank_name ?? "",
      l.agency ?? "",
      l.loan_number ?? "",
      l.first_payment_date ?? "",
      l.payment_day ?? 25,
      l.total_payments ?? 0,
      l.paid_payments ?? 0,
      l.insurance_rate ?? 0,
      l.tax_rate ?? 0,
      l.fees_amount ?? 0,
    ],
  });
  return rowToObj<Loan>(rs.rows[0] as Row, rs.columns);
}

export async function updateLoan(id: number, updates: Partial<Loan>): Promise<Loan | null> {
  await ensureMigrations();
  const db = getDbClient();
  const currentRs = await db.execute({ sql: "SELECT * FROM loans WHERE id = ?", args: [id] });
  if (currentRs.rows.length === 0) return null;
  const current = rowToObj<Loan>(currentRs.rows[0] as Row, currentRs.columns);
  const m = { ...current, ...updates };
  const paidPayments = m.paid_payments ?? (current as Loan).paid_payments ?? 0;
  await db.execute({
    sql: `UPDATE loans SET type=?, label=?, lender_borrower=?, total_amount=?, remaining_amount=?, interest_rate=?, fees=?, monthly_payment=?, start_date=?, end_date=?, next_due_date=?, notes=?, status=?, paid_payments=? WHERE id=?`,
    args: [
      m.type,
      m.label,
      m.lender_borrower,
      m.total_amount,
      m.remaining_amount,
      m.interest_rate,
      m.fees,
      m.monthly_payment,
      m.start_date,
      m.end_date,
      m.next_due_date,
      m.notes,
      m.status,
      paidPayments,
      id,
    ],
  });
  const rs = await db.execute({ sql: "SELECT * FROM loans WHERE id = ?", args: [id] });
  return rowToObj<Loan>(rs.rows[0] as Row, rs.columns);
}

export async function deleteLoan(id: number): Promise<boolean> {
  await ensureMigrations();
  const rs = await getDbClient().execute({ sql: "DELETE FROM loans WHERE id = ?", args: [id] });
  return (rs.rowsAffected ?? 0) > 0;
}

// ── Loan Schedule ──

export async function getLoanSchedule(loanId: number): Promise<LoanScheduleRow[]> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "SELECT * FROM loan_schedule WHERE loan_id = ? ORDER BY number ASC",
    args: [loanId],
  });
  return rowsToObjs<LoanScheduleRow>(rs.rows as Row[], rs.columns);
}

export async function saveLoanSchedule(userId: number, loanId: number, rows: LoanScheduleInput[]): Promise<void> {
  await ensureMigrations();
  const db = getDbClient();
  const tx = await db.transaction("write");
  try {
    await tx.execute({ sql: "DELETE FROM loan_schedule WHERE loan_id = ?", args: [loanId] });
    for (const r of rows) {
      await tx.execute({
        sql: `INSERT INTO loan_schedule (user_id, loan_id, number, due_date, principal, interest, insurance, tax_interest, tax_insurance, fees, total_payment, remaining_balance, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          userId,
          loanId,
          r.number,
          r.due_date,
          r.principal,
          r.interest,
          r.insurance,
          r.tax_interest,
          r.tax_insurance,
          r.fees,
          r.total_payment,
          r.remaining_balance,
          r.status,
        ],
      });
    }
    await tx.commit();
  } finally {
    tx.close();
  }
}

export async function markSchedulePaid(loanId: number, scheduleNumber: number, note?: string): Promise<LoanScheduleRow | null> {
  await ensureMigrations();
  const db = getDbClient();
  const tx = await db.transaction("write");
  try {
    const rs = await tx.execute({
      sql: "SELECT * FROM loan_schedule WHERE loan_id = ? AND number = ?",
      args: [loanId, scheduleNumber],
    });
    if (rs.rows.length === 0) return null;
    const row = rowToObj<LoanScheduleRow>(rs.rows[0] as Row, rs.columns);
    if (row.status === "paid") {
      await tx.commit();
      return row;
    }
    const now = new Date().toISOString();
    await tx.execute({
      sql: "UPDATE loan_schedule SET status = 'paid', paid_at = ?, payment_note = ? WHERE loan_id = ? AND number = ?",
      args: [now, note ?? "", loanId, scheduleNumber],
    });
    const loanRs = await tx.execute({ sql: "SELECT * FROM loans WHERE id = ?", args: [loanId] });
    if (loanRs.rows.length > 0) {
      const loan = rowToObj<Loan>(loanRs.rows[0] as Row, loanRs.columns);
      const paidCount = (loan.paid_payments ?? 0) + 1;
      const newRemaining = row.remaining_balance;
      await tx.execute({
        sql: "UPDATE loans SET remaining_amount = ?, paid_payments = ?, status = ? WHERE id = ?",
        args: [newRemaining, paidCount, newRemaining === 0 ? "completed" : loan.status, loanId],
      });
    }
    await tx.commit();
    const updated = await db.execute({
      sql: "SELECT * FROM loan_schedule WHERE loan_id = ? AND number = ?",
      args: [loanId, scheduleNumber],
    });
    return rowToObj<LoanScheduleRow>(updated.rows[0] as Row, updated.columns);
  } finally {
    tx.close();
  }
}

export async function updateScheduleExpenseId(loanId: number, scheduleNumber: number, expenseId: number): Promise<void> {
  await ensureMigrations();
  await getDbClient().execute({
    sql: "UPDATE loan_schedule SET expense_id = ? WHERE loan_id = ? AND number = ?",
    args: [expenseId, loanId, scheduleNumber],
  });
}

export async function getScheduleByExpenseId(expenseId: number): Promise<{ loan_id: number; number: number } | null> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "SELECT loan_id, number FROM loan_schedule WHERE expense_id = ?",
    args: [expenseId],
  });
  if (rs.rows.length === 0) return null;
  const r = rs.rows[0] as Row;
  return { loan_id: r.loan_id as number, number: r.number as number };
}

export async function markScheduleUnpaid(loanId: number, scheduleNumber: number): Promise<LoanScheduleRow | null> {
  await ensureMigrations();
  const db = getDbClient();
  const tx = await db.transaction("write");
  try {
    const rs = await tx.execute({
      sql: "SELECT * FROM loan_schedule WHERE loan_id = ? AND number = ?",
      args: [loanId, scheduleNumber],
    });
    if (rs.rows.length === 0) return null;
    const row = rowToObj<LoanScheduleRow>(rs.rows[0] as Row, rs.columns);
    if (row.status !== "paid") {
      await tx.commit();
      return row;
    }
    const expenseId = row.expense_id ?? undefined;
    await tx.execute({
      sql: "UPDATE loan_schedule SET status = 'pending', paid_at = NULL, payment_note = '', expense_id = NULL WHERE loan_id = ? AND number = ?",
      args: [loanId, scheduleNumber],
    });
    if (typeof expenseId === "number" && expenseId > 0) {
      await tx.execute({ sql: "DELETE FROM expenses WHERE id = ?", args: [expenseId] });
    }
    const loanRs = await tx.execute({ sql: "SELECT * FROM loans WHERE id = ?", args: [loanId] });
    if (loanRs.rows.length > 0) {
      const loan = rowToObj<Loan>(loanRs.rows[0] as Row, loanRs.columns);
      const paidCount = Math.max(0, (loan.paid_payments ?? 0) - 1);
      const prevRow = await tx.execute({
        sql: "SELECT remaining_balance FROM loan_schedule WHERE loan_id = ? AND number = ?",
        args: [loanId, scheduleNumber - 1],
      });
      const newRemaining = prevRow.rows.length > 0
        ? Number((prevRow.rows[0] as Row).remaining_balance)
        : loan.total_amount;
      await tx.execute({
        sql: "UPDATE loans SET remaining_amount = ?, paid_payments = ?, status = ? WHERE id = ?",
        args: [newRemaining, paidCount, "active", loanId],
      });
    }
    await tx.commit();
    const updated = await db.execute({
      sql: "SELECT * FROM loan_schedule WHERE loan_id = ? AND number = ?",
      args: [loanId, scheduleNumber],
    });
    return rowToObj<LoanScheduleRow>(updated.rows[0] as Row, updated.columns);
  } finally {
    tx.close();
  }
}

export async function getUpcomingSchedules(
  userId: number,
  daysAhead: number = 7
): Promise<(LoanScheduleRow & { loan_label: string })[]> {
  await ensureMigrations();
  const today = new Date().toISOString().split("T")[0];
  const future = new Date();
  future.setDate(future.getDate() + daysAhead);
  const endDate = future.toISOString().split("T")[0];
  return getSchedulesForPeriod(userId, today, endDate);
}

/** Échéances du mois en cours (entre startDate et endDate inclus) */
export async function getSchedulesForPeriod(
  userId: number,
  startDate: string,
  endDate: string
): Promise<(LoanScheduleRow & { loan_label: string })[]> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: `SELECT s.*, l.label as loan_label FROM loan_schedule s
          JOIN loans l ON l.id = s.loan_id
          WHERE s.user_id = ? AND s.status IN ('pending','upcoming') AND s.due_date >= ? AND s.due_date <= ?
          ORDER BY s.due_date ASC`,
    args: [userId, startDate, endDate],
  });
  return rowsToObjs<LoanScheduleRow & { loan_label: string }>(rs.rows as Row[], rs.columns);
}

export async function getOverdueSchedules(userId: number): Promise<(LoanScheduleRow & { loan_label: string })[]> {
  await ensureMigrations();
  const today = new Date().toISOString().split("T")[0];
  const rs = await getDbClient().execute({
    sql: `SELECT s.*, l.label as loan_label FROM loan_schedule s
          JOIN loans l ON l.id = s.loan_id
          WHERE s.user_id = ? AND s.status IN ('pending','overdue') AND s.due_date < ?
          ORDER BY s.due_date ASC`,
    args: [userId, today],
  });
  return rowsToObjs<LoanScheduleRow & { loan_label: string }>(rs.rows as Row[], rs.columns);
}

export async function refreshScheduleStatuses(userId: number): Promise<void> {
  await ensureMigrations();
  const db = getDbClient();
  const today = new Date().toISOString().split("T")[0];
  const future = new Date();
  future.setDate(future.getDate() + 7);
  const in7Days = future.toISOString().split("T")[0];
  await db.execute({
    sql: "UPDATE loan_schedule SET status = 'overdue' WHERE user_id = ? AND status IN ('pending','upcoming') AND due_date < ?",
    args: [userId, today],
  });
  await db.execute({
    sql: "UPDATE loan_schedule SET status = 'upcoming' WHERE user_id = ? AND status = 'pending' AND due_date >= ? AND due_date <= ?",
    args: [userId, today, in7Days],
  });
  await db.execute({
    sql: "UPDATE loan_schedule SET status = 'pending' WHERE user_id = ? AND status = 'upcoming' AND due_date > ?",
    args: [userId, in7Days],
  });
}

// ── Loan Payments ──

export async function getLoanPayments(loanId?: number, month?: number, year?: number): Promise<LoanPayment[]> {
  await ensureMigrations();
  const db = getDbClient();
  let rs;
  if (loanId) {
    rs = await db.execute({
      sql: "SELECT * FROM loan_payments WHERE loan_id = ? ORDER BY date DESC, time DESC",
      args: [loanId],
    });
  } else if (month !== undefined && year !== undefined) {
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endMonth = month === 11 ? 1 : month + 2;
    const endYear = month === 11 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
    rs = await db.execute({
      sql: "SELECT * FROM loan_payments WHERE date >= ? AND date < ? ORDER BY date DESC, time DESC",
      args: [startDate, endDate],
    });
  } else {
    rs = await db.execute("SELECT * FROM loan_payments ORDER BY date DESC, time DESC");
  }
  return rowsToObjs<LoanPayment>(rs.rows as Row[], rs.columns);
}

export async function getLoanPaymentsByDateRange(start: string, end: string): Promise<LoanPayment[]> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "SELECT * FROM loan_payments WHERE date >= ? AND date <= ? ORDER BY date DESC, time DESC, id DESC",
    args: [start, end],
  });
  return rowsToObjs<LoanPayment>(rs.rows as Row[], rs.columns);
}

export async function updateLoanPaymentExpenseId(paymentId: number, expenseId: number): Promise<void> {
  await ensureMigrations();
  await getDbClient().execute({
    sql: "UPDATE loan_payments SET expense_id = ? WHERE id = ?",
    args: [expenseId, paymentId],
  });
}

export async function updateLoanPaymentIncomeId(paymentId: number, incomeId: number): Promise<void> {
  await ensureMigrations();
  await getDbClient().execute({
    sql: "UPDATE loan_payments SET income_id = ? WHERE id = ?",
    args: [incomeId, paymentId],
  });
}

export async function getPaymentByExpenseId(expenseId: number): Promise<{ id: number } | null> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "SELECT id FROM loan_payments WHERE expense_id = ?",
    args: [expenseId],
  });
  if (rs.rows.length === 0) return null;
  return { id: (rs.rows[0] as Row).id as number };
}

export async function getPaymentByIncomeId(incomeId: number): Promise<{ id: number } | null> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "SELECT id FROM loan_payments WHERE income_id = ?",
    args: [incomeId],
  });
  if (rs.rows.length === 0) return null;
  return { id: (rs.rows[0] as Row).id as number };
}

export async function addLoanPayment(p: Omit<LoanPayment, "id" | "created_at">): Promise<LoanPayment> {
  await ensureMigrations();
  const db = getDbClient();
  const tx = await db.transaction("write");
  try {
    const ins = await tx.execute({
      sql: "INSERT INTO loan_payments (loan_id, amount, fees, date, time, notes) VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
      args: [p.loan_id, p.amount, p.fees || 0, p.date, p.time || "00:00", p.notes || ""],
    });
    const payment = rowToObj<LoanPayment>(ins.rows[0] as Row, ins.columns);
    const loanRs = await tx.execute({ sql: "SELECT * FROM loans WHERE id = ?", args: [p.loan_id] });
    if (loanRs.rows.length > 0) {
      const loan = rowToObj<Loan>(loanRs.rows[0] as Row, loanRs.columns);
      const newRemaining = Math.max(0, loan.remaining_amount - p.amount);
      await tx.execute({
        sql: "UPDATE loans SET remaining_amount = ?, status = ? WHERE id = ?",
        args: [newRemaining, newRemaining === 0 ? "completed" : loan.status, p.loan_id],
      });
    }
    await tx.commit();
    return payment;
  } finally {
    tx.close();
  }
}

export async function addLoanPaymentsBatch(
  loanId: number,
  payments: Array<{ amount: number; fees: number; date: string; time: string; notes: string }>
): Promise<number> {
  await ensureMigrations();
  const db = getDbClient();
  const tx = await db.transaction("write");
  try {
    let totalDeducted = 0;
    for (const p of payments) {
      await tx.execute({
        sql: "INSERT INTO loan_payments (loan_id, amount, fees, date, time, notes) VALUES (?, ?, ?, ?, ?, ?)",
        args: [loanId, p.amount, p.fees || 0, p.date, p.time || "00:00", p.notes || ""],
      });
      totalDeducted += p.amount;
    }
    const loanRs = await tx.execute({ sql: "SELECT * FROM loans WHERE id = ?", args: [loanId] });
    if (loanRs.rows.length > 0) {
      const loan = rowToObj<Loan>(loanRs.rows[0] as Row, loanRs.columns);
      const newRemaining = Math.max(0, loan.remaining_amount - totalDeducted);
      await tx.execute({
        sql: "UPDATE loans SET remaining_amount = ?, status = ? WHERE id = ?",
        args: [newRemaining, newRemaining === 0 ? "completed" : loan.status, loanId],
      });
    }
    await tx.commit();
    return payments.length;
  } finally {
    tx.close();
  }
}

export async function updateLoanPayment(
  id: number,
  updates: Partial<Pick<LoanPayment, "amount" | "fees" | "date" | "time" | "notes">>
): Promise<LoanPayment | null> {
  await ensureMigrations();
  const db = getDbClient();
  const currentRs = await db.execute({ sql: "SELECT * FROM loan_payments WHERE id = ?", args: [id] });
  if (currentRs.rows.length === 0) return null;
  const current = rowToObj<LoanPayment>(currentRs.rows[0] as Row, currentRs.columns);
  const merged = { ...current, ...updates };
  await db.execute({
    sql: "UPDATE loan_payments SET amount=?, fees=?, date=?, time=?, notes=? WHERE id=?",
    args: [merged.amount, merged.fees ?? 0, merged.date, merged.time ?? "00:00", merged.notes ?? "", id],
  });
  if (updates.amount !== undefined && updates.amount !== current.amount) {
    const loanRs = await db.execute({ sql: "SELECT * FROM loans WHERE id = ?", args: [current.loan_id] });
    if (loanRs.rows.length > 0) {
      const loan = rowToObj<Loan>(loanRs.rows[0] as Row, loanRs.columns);
      const delta = current.amount - updates.amount;
      const newRemaining = Math.max(0, loan.remaining_amount + delta);
      await db.execute({
        sql: "UPDATE loans SET remaining_amount = ?, status = ? WHERE id = ?",
        args: [newRemaining, newRemaining === 0 ? "completed" : loan.status, current.loan_id],
      });
    }
  }
  const rs = await db.execute({ sql: "SELECT * FROM loan_payments WHERE id = ?", args: [id] });
  return rowToObj<LoanPayment>(rs.rows[0] as Row, rs.columns);
}

export async function deleteLoanPayment(id: number): Promise<boolean> {
  await ensureMigrations();
  const db = getDbClient();
  const paymentRs = await db.execute({ sql: "SELECT * FROM loan_payments WHERE id = ?", args: [id] });
  if (paymentRs.rows.length === 0) return false;
  const payment = rowToObj<LoanPayment>(paymentRs.rows[0] as Row, paymentRs.columns);
  const expenseId = payment.expense_id ?? undefined;
  const incomeId = payment.income_id ?? undefined;
  await db.execute({ sql: "UPDATE loan_payments SET expense_id = NULL, income_id = NULL WHERE id = ?", args: [id] });
  if (typeof expenseId === "number" && expenseId > 0) {
    await db.execute({ sql: "DELETE FROM expenses WHERE id = ?", args: [expenseId] });
  }
  if (typeof incomeId === "number" && incomeId > 0) {
    await db.execute({ sql: "DELETE FROM incomes WHERE id = ?", args: [incomeId] });
  }
  const del = await db.execute({ sql: "DELETE FROM loan_payments WHERE id = ?", args: [id] });
  if ((del.rowsAffected ?? 0) > 0) {
    const loanRs = await db.execute({ sql: "SELECT * FROM loans WHERE id = ?", args: [payment.loan_id] });
    if (loanRs.rows.length > 0) {
      const loan = rowToObj<Loan>(loanRs.rows[0] as Row, loanRs.columns);
      const newRemaining = loan.remaining_amount + payment.amount;
      await db.execute({
        sql: "UPDATE loans SET remaining_amount = ?, status = ? WHERE id = ?",
        args: [newRemaining, "active", payment.loan_id],
      });
    }
  }
  return (del.rowsAffected ?? 0) > 0;
}

// ── Fixed Charge Payments ──

export async function ensureRecurringPayments(month: number, year: number): Promise<number> {
  const now = new Date();
  if (month !== now.getMonth() || year !== now.getFullYear()) return 0;

  const config = await getConfig();
  const existing = await getFixedChargePayments(month, year);
  const existingChargeIds = new Set(existing.map((p) => p.charge_id));
  let created = 0;
  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;

  for (const ch of config.fixedCharges || []) {
    if (ch.amount <= 0 || existingChargeIds.has(ch.id)) continue;
    await addFixedChargePayment({
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

export async function getFixedChargePayments(month?: number, year?: number): Promise<FixedChargePayment[]> {
  await ensureMigrations();
  const db = getDbClient();
  let rs;
  if (month !== undefined && year !== undefined) {
    rs = await db.execute({
      sql: "SELECT * FROM fixed_charge_payments WHERE month = ? AND year = ? ORDER BY date DESC, time DESC, id DESC",
      args: [month, year],
    });
  } else {
    rs = await db.execute("SELECT * FROM fixed_charge_payments ORDER BY date DESC, time DESC, id DESC");
  }
  return rowsToObjs<FixedChargePayment>(rs.rows as Row[], rs.columns);
}

export async function getFixedChargePaymentsByDateRange(start: string, end: string): Promise<FixedChargePayment[]> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "SELECT * FROM fixed_charge_payments WHERE date >= ? AND date <= ? ORDER BY date DESC, time DESC, id DESC",
    args: [start, end],
  });
  return rowsToObjs<FixedChargePayment>(rs.rows as Row[], rs.columns);
}

export async function addFixedChargePayment(p: Omit<FixedChargePayment, "id" | "created_at">): Promise<FixedChargePayment> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "INSERT INTO fixed_charge_payments (charge_id, label, icon, amount, date, time, month, year, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
    args: [p.charge_id, p.label, p.icon, p.amount, p.date, p.time || "00:00", p.month, p.year, p.notes || ""],
  });
  return rowToObj<FixedChargePayment>(rs.rows[0] as Row, rs.columns);
}

export async function deleteFixedChargePayment(id: number): Promise<boolean> {
  await ensureMigrations();
  const rs = await getDbClient().execute({ sql: "DELETE FROM fixed_charge_payments WHERE id = ?", args: [id] });
  return (rs.rowsAffected ?? 0) > 0;
}

// ── Projects ──

export async function getProjects(): Promise<Project[]> {
  await ensureProjectFundsMigration();
  await ensureMigrations();
  const rs = await getDbClient().execute("SELECT * FROM projects ORDER BY status ASC, created_at DESC");
  return rowsToObjs<Project>(rs.rows as Row[], rs.columns);
}

export async function addProject(p: Omit<Project, "id" | "created_at">): Promise<Project> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "INSERT INTO projects (name, description, target_amount, saved_amount, deadline, color, icon, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
    args: [
      p.name,
      p.description,
      p.target_amount,
      p.saved_amount || 0,
      p.deadline,
      p.color,
      p.icon,
      p.status || "active",
    ],
  });
  return rowToObj<Project>(rs.rows[0] as Row, rs.columns);
}

export async function updateProject(id: number, updates: Partial<Project>): Promise<Project | null> {
  await ensureMigrations();
  const db = getDbClient();
  const currentRs = await db.execute({ sql: "SELECT * FROM projects WHERE id = ?", args: [id] });
  if (currentRs.rows.length === 0) return null;
  const current = rowToObj<Project>(currentRs.rows[0] as Row, currentRs.columns);
  const merged = { ...current, ...updates };
  await db.execute({
    sql: "UPDATE projects SET name=?, description=?, target_amount=?, saved_amount=?, deadline=?, color=?, icon=?, status=? WHERE id=?",
    args: [
      merged.name,
      merged.description,
      merged.target_amount,
      merged.saved_amount,
      merged.deadline,
      merged.color,
      merged.icon,
      merged.status,
      id,
    ],
  });
  const rs = await db.execute({ sql: "SELECT * FROM projects WHERE id = ?", args: [id] });
  return rowToObj<Project>(rs.rows[0] as Row, rs.columns);
}

export async function deleteProject(id: number): Promise<boolean> {
  await ensureMigrations();
  const db = getDbClient();
  const purchasesRs = await db.execute({
    sql: "SELECT expense_id FROM project_purchases WHERE project_id = ? AND expense_id IS NOT NULL",
    args: [id],
  });
  const purchases = rowsToObjs<{ expense_id: number }>(purchasesRs.rows as Row[], purchasesRs.columns);
  for (const { expense_id } of purchases) {
    await db.execute({ sql: "DELETE FROM expenses WHERE id = ?", args: [expense_id] });
  }
  const rs = await db.execute({ sql: "DELETE FROM projects WHERE id = ?", args: [id] });
  return (rs.rowsAffected ?? 0) > 0;
}

export async function getProject(id: number): Promise<Project | null> {
  await ensureMigrations();
  const rs = await getDbClient().execute({ sql: "SELECT * FROM projects WHERE id = ?", args: [id] });
  return rs.rows.length > 0 ? (rowToObj<Project>(rs.rows[0] as Row, rs.columns) as Project) : null;
}

// ── Project Funds ──

async function syncProjectSavedAmount(projectId: number): Promise<void> {
  const db = getDbClient();
  const fundsRs = await db.execute({
    sql: "SELECT COALESCE(SUM(amount), 0) as total FROM project_funds WHERE project_id = ?",
    args: [projectId],
  });
  const spentRs = await db.execute({
    sql: "SELECT COALESCE(SUM(amount), 0) as total FROM project_purchases WHERE project_id = ?",
    args: [projectId],
  });
  const fundsTotal = Number((fundsRs.rows[0] as Row)?.total ?? 0);
  const spentTotal = Number((spentRs.rows[0] as Row)?.total ?? 0);
  const remaining = Math.max(0, fundsTotal - spentTotal);
  await db.execute({ sql: "UPDATE projects SET saved_amount = ? WHERE id = ?", args: [remaining, projectId] });
}

export async function getProjectFunds(projectId: number): Promise<ProjectFund[]> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "SELECT * FROM project_funds WHERE project_id = ? ORDER BY date DESC, created_at DESC",
    args: [projectId],
  });
  return rowsToObjs<ProjectFund>(rs.rows as Row[], rs.columns);
}

export async function addProjectFund(
  f: Omit<ProjectFund, "id" | "created_at"> & { income_id?: number | null }
): Promise<ProjectFund> {
  await ensureMigrations();
  const db = getDbClient();
  const rs = await db.execute({
    sql: "INSERT INTO project_funds (project_id, amount, date, notes, income_id) VALUES (?, ?, ?, ?, ?) RETURNING *",
    args: [f.project_id, f.amount, f.date, f.notes || "", f.income_id ?? null],
  });
  const fund = rowToObj<ProjectFund>(rs.rows[0] as Row, rs.columns);
  await syncProjectSavedAmount(f.project_id);
  return fund;
}

export async function updateProjectFund(
  id: number,
  updates: { amount?: number; date?: string; notes?: string }
): Promise<ProjectFund | null> {
  await ensureMigrations();
  const db = getDbClient();
  const currentRs = await db.execute({ sql: "SELECT * FROM project_funds WHERE id = ?", args: [id] });
  if (currentRs.rows.length === 0) return null;
  const current = rowToObj<ProjectFund & { income_id?: number | null }>(currentRs.rows[0] as Row, currentRs.columns);
  const m = { ...current, ...updates };
  await db.execute({
    sql: "UPDATE project_funds SET amount=?, date=?, notes=? WHERE id=?",
    args: [m.amount, m.date, m.notes || "", id],
  });
  if (current.income_id && (updates.amount !== undefined || updates.date !== undefined)) {
    const incRs = await db.execute({ sql: "SELECT * FROM incomes WHERE id = ?", args: [current.income_id] });
    if (incRs.rows.length > 0) {
      const inc = rowToObj<{ amount: number; date: string }>(incRs.rows[0] as Row, incRs.columns);
      await db.execute({
        sql: "UPDATE incomes SET amount=?, date=? WHERE id=?",
        args: [updates.amount ?? inc.amount, updates.date ?? inc.date, current.income_id],
      });
    }
  }
  await syncProjectSavedAmount(current.project_id);
  const rs = await db.execute({ sql: "SELECT * FROM project_funds WHERE id = ?", args: [id] });
  return rowToObj<ProjectFund>(rs.rows[0] as Row, rs.columns);
}

export async function deleteProjectFund(id: number): Promise<boolean> {
  await ensureMigrations();
  const db = getDbClient();
  const fundRs = await db.execute({ sql: "SELECT * FROM project_funds WHERE id = ?", args: [id] });
  if (fundRs.rows.length === 0) return false;
  const fund = rowToObj<ProjectFund & { income_id?: number | null }>(fundRs.rows[0] as Row, fundRs.columns);
  if (fund.income_id) {
    await db.execute({ sql: "DELETE FROM incomes WHERE id = ?", args: [fund.income_id] });
  }
  const rs = await db.execute({ sql: "DELETE FROM project_funds WHERE id = ?", args: [id] });
  if ((rs.rowsAffected ?? 0) > 0) await syncProjectSavedAmount(fund.project_id);
  return (rs.rowsAffected ?? 0) > 0;
}

export async function getProjectFundsSumForMonth(month: number, year: number): Promise<number> {
  await ensureMigrations();
  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const rs = await getDbClient().execute({
    sql: "SELECT COALESCE(SUM(amount), 0) as total FROM project_funds WHERE date >= ? AND date <= ?",
    args: [startDate, endDate],
  });
  return Number((rs.rows[0] as Row)?.total ?? 0);
}

export async function migrateProjectFundsIfNeeded(): Promise<void> {
  const db = getDbClient();
  const projectsRs = await db.execute("SELECT id, saved_amount FROM projects WHERE saved_amount > 0");
  const projects = rowsToObjs<{ id: number; saved_amount: number }>(projectsRs.rows as Row[], projectsRs.columns);
  for (const p of projects) {
    const countRs = await db.execute({
      sql: "SELECT COUNT(*) as c FROM project_funds WHERE project_id = ?",
      args: [p.id],
    });
    const count = Number((countRs.rows[0] as Row)?.c ?? 0);
    if (count === 0) {
      await db.execute({
        sql: "INSERT INTO project_funds (project_id, amount, date, notes) VALUES (?, ?, date('now'), 'Migration')",
        args: [p.id, p.saved_amount],
      });
    }
  }
}

// ── Project Purchases ──

export async function getProjectPurchase(id: number): Promise<ProjectPurchase | null> {
  await ensureMigrations();
  const rs = await getDbClient().execute({ sql: "SELECT * FROM project_purchases WHERE id = ?", args: [id] });
  return rs.rows.length > 0 ? (rowToObj<ProjectPurchase>(rs.rows[0] as Row, rs.columns) as ProjectPurchase) : null;
}

export async function getProjectPurchases(projectId: number): Promise<ProjectPurchase[]> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "SELECT * FROM project_purchases WHERE project_id = ? ORDER BY date DESC, created_at DESC",
    args: [projectId],
  });
  return rowsToObjs<ProjectPurchase>(rs.rows as Row[], rs.columns);
}

export async function addProjectPurchase(p: Omit<ProjectPurchase, "id" | "created_at">): Promise<ProjectPurchase> {
  await ensureMigrations();
  const db = getDbClient();
  const rs = await db.execute({
    sql: "INSERT INTO project_purchases (project_id, description, amount, date, expense_id) VALUES (?, ?, ?, ?, ?) RETURNING *",
    args: [p.project_id, p.description, p.amount, p.date, p.expense_id ?? null],
  });
  const purchase = rowToObj<ProjectPurchase>(rs.rows[0] as Row, rs.columns);
  await syncProjectSavedAmount(p.project_id);
  return purchase;
}

export async function deleteProjectPurchase(id: number): Promise<boolean> {
  await ensureMigrations();
  const db = getDbClient();
  const purchaseRs = await db.execute({ sql: "SELECT project_id FROM project_purchases WHERE id = ?", args: [id] });
  const rs = await db.execute({ sql: "DELETE FROM project_purchases WHERE id = ?", args: [id] });
  if ((rs.rowsAffected ?? 0) > 0 && purchaseRs.rows.length > 0) {
    const purchase = rowToObj<{ project_id: number }>(purchaseRs.rows[0] as Row, purchaseRs.columns);
    await syncProjectSavedAmount(purchase.project_id);
  }
  return (rs.rowsAffected ?? 0) > 0;
}

// ── Planned Expenses ──

export async function getPlannedExpenses(status?: string): Promise<PlannedExpense[]> {
  await ensureMigrations();
  const db = getDbClient();
  let rs;
  if (status) {
    rs = await db.execute({
      sql: "SELECT * FROM planned_expenses WHERE status = ? ORDER BY due_date ASC",
      args: [status],
    });
  } else {
    rs = await db.execute("SELECT * FROM planned_expenses ORDER BY due_date ASC");
  }
  return rowsToObjs<PlannedExpense>(rs.rows as Row[], rs.columns);
}

export async function addPlannedExpense(
  p: Omit<PlannedExpense, "id" | "created_at" | "expense_id">
): Promise<PlannedExpense> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "INSERT INTO planned_expenses (due_date, description, category, amount, notes, status) VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
    args: [p.due_date, p.description, p.category, p.amount, p.notes || "", p.status || "pending"],
  });
  return rowToObj<PlannedExpense>(rs.rows[0] as Row, rs.columns);
}

export async function updatePlannedExpense(id: number, updates: Partial<PlannedExpense>): Promise<PlannedExpense | null> {
  await ensureMigrations();
  const db = getDbClient();
  const currentRs = await db.execute({ sql: "SELECT * FROM planned_expenses WHERE id = ?", args: [id] });
  if (currentRs.rows.length === 0) return null;
  const current = rowToObj<PlannedExpense>(currentRs.rows[0] as Row, currentRs.columns);
  const merged = { ...current, ...updates };
  await db.execute({
    sql: "UPDATE planned_expenses SET due_date=?, description=?, category=?, amount=?, notes=? WHERE id=?",
    args: [merged.due_date, merged.description, merged.category, merged.amount, merged.notes || "", id],
  });
  const rs = await db.execute({ sql: "SELECT * FROM planned_expenses WHERE id = ?", args: [id] });
  return rowToObj<PlannedExpense>(rs.rows[0] as Row, rs.columns);
}

export async function executePlannedExpenseById(id: number, userId: number): Promise<Expense | null> {
  await ensureMigrations();
  const db = getDbClient();
  const pRs = await db.execute({
    sql: "SELECT * FROM planned_expenses WHERE id = ? AND status = 'pending'",
    args: [id],
  });
  if (pRs.rows.length === 0) return null;
  const p = rowToObj<PlannedExpense>(pRs.rows[0] as Row, pRs.columns);
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const ins = await db.execute({
    sql: "INSERT INTO expenses (user_id, date, time, description, category, amount, notes) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
    args: [userId, today, time, p.description, p.category, p.amount, p.notes ? `[Planifié] ${p.notes}` : "[Planifié]"],
  });
  const expense = rowToObj<Expense>(ins.rows[0] as Row, ins.columns);
  await db.execute({
    sql: "UPDATE planned_expenses SET status = 'executed', expense_id = ? WHERE id = ?",
    args: [expense.id, id],
  });
  return expense;
}

export async function deletePlannedExpense(id: number): Promise<boolean> {
  await ensureMigrations();
  const db = getDbClient();
  const pRs = await db.execute({ sql: "SELECT * FROM planned_expenses WHERE id = ?", args: [id] });
  if (pRs.rows.length === 0) return false;
  const p = rowToObj<PlannedExpense>(pRs.rows[0] as Row, pRs.columns);
  if (p.status === "executed" && p.expense_id) {
    await db.execute({ sql: "DELETE FROM expenses WHERE id = ?", args: [p.expense_id] });
  }
  const rs = await db.execute({ sql: "DELETE FROM planned_expenses WHERE id = ?", args: [id] });
  return (rs.rowsAffected ?? 0) > 0;
}

export async function executeDuePlannedExpenses(userId: number): Promise<{ executed: number; ids: number[] }> {
  await ensureMigrations();
  const db = getDbClient();
  const today = new Date().toISOString().split("T")[0];
  const dueRs = await db.execute({
    sql: "SELECT * FROM planned_expenses WHERE status = 'pending' AND due_date <= ?",
    args: [today],
  });
  const due = rowsToObjs<PlannedExpense>(dueRs.rows as Row[], dueRs.columns);
  const executedIds: number[] = [];
  const tx = await db.transaction("write");
  try {
    for (const p of due) {
      const ins = await tx.execute({
        sql: "INSERT INTO expenses (user_id, date, time, description, category, amount, notes) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
        args: [userId, p.due_date, "00:00", p.description, p.category, p.amount, p.notes ? `[Planifié] ${p.notes}` : "[Planifié]"],
      });
      const exp = rowToObj<Expense>(ins.rows[0] as Row, ins.columns);
      await tx.execute({
        sql: "UPDATE planned_expenses SET status = 'executed', expense_id = ? WHERE id = ?",
        args: [exp.id, p.id],
      });
      executedIds.push(p.id);
    }
    await tx.commit();
  } finally {
    tx.close();
  }
  return { executed: executedIds.length, ids: executedIds };
}

// ── Wishes (liste des envies) ──

export async function getWishes(status?: "pending" | "purchased"): Promise<Wish[]> {
  await ensureMigrations();
  const db = getDbClient();
  let rs;
  if (status) {
    rs = await db.execute({
      sql: "SELECT * FROM wishes WHERE status = ? ORDER BY target_date ASC, created_at ASC",
      args: [status],
    });
  } else {
    rs = await db.execute("SELECT * FROM wishes ORDER BY target_date ASC, created_at ASC");
  }
  return rowsToObjs<Wish>(rs.rows as Row[], rs.columns);
}

export async function addWish(w: Omit<Wish, "id" | "created_at">): Promise<Wish> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "INSERT INTO wishes (name, target_date, estimated_amount, actual_amount, category, subcategory, notes, status, expense_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
    args: [w.name, w.target_date, w.estimated_amount, w.actual_amount ?? null, w.category, w.subcategory ?? null, w.notes || "", w.status || "pending", w.expense_id ?? null],
  });
  return rowToObj<Wish>(rs.rows[0] as Row, rs.columns);
}

export async function updateWish(id: number, updates: Partial<Pick<Wish, "name" | "target_date" | "estimated_amount" | "actual_amount" | "category" | "subcategory" | "notes">>): Promise<Wish | null> {
  await ensureMigrations();
  const db = getDbClient();
  const currentRs = await db.execute({ sql: "SELECT * FROM wishes WHERE id = ?", args: [id] });
  if (currentRs.rows.length === 0) return null;
  const current = rowToObj<Wish>(currentRs.rows[0] as Row, currentRs.columns);
  const merged = { ...current, ...updates };
  await db.execute({
    sql: "UPDATE wishes SET name=?, target_date=?, estimated_amount=?, actual_amount=?, category=?, subcategory=?, notes=? WHERE id=?",
    args: [merged.name, merged.target_date, merged.estimated_amount, merged.actual_amount ?? null, merged.category, merged.subcategory ?? null, merged.notes || "", id],
  });
  if (current.status === "purchased" && current.expense_id) {
    const amount = merged.actual_amount ?? merged.estimated_amount;
    await db.execute({
      sql: "UPDATE expenses SET description=?, category=?, amount=?, notes=? WHERE id=?",
      args: [merged.name, merged.category, amount, merged.notes ? `[Envie achetée] ${merged.notes}` : "[Envie achetée]", current.expense_id],
    });
  }
  const rs = await db.execute({ sql: "SELECT * FROM wishes WHERE id = ?", args: [id] });
  return rowToObj<Wish>(rs.rows[0] as Row, rs.columns);
}

export async function markWishPurchased(id: number, actualAmount: number, userId: number): Promise<Expense | null> {
  await ensureMigrations();
  const db = getDbClient();
  const wRs = await db.execute({ sql: "SELECT * FROM wishes WHERE id = ? AND status = 'pending'", args: [id] });
  if (wRs.rows.length === 0) return null;
  const w = rowToObj<Wish>(wRs.rows[0] as Row, wRs.columns);
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const ins = await db.execute({
    sql: "INSERT INTO expenses (user_id, date, time, description, category, amount, notes) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
    args: [userId, today, time, w.name, w.category, actualAmount, w.notes ? `[Envie achetée] ${w.notes}` : "[Envie achetée]"],
  });
  const expense = rowToObj<Expense>(ins.rows[0] as Row, ins.columns);
  await db.execute({
    sql: "UPDATE wishes SET status = 'purchased', actual_amount = ?, expense_id = ? WHERE id = ?",
    args: [actualAmount, expense.id, id],
  });
  return expense;
}

export async function deleteWish(id: number): Promise<boolean> {
  await ensureMigrations();
  const db = getDbClient();
  const wRs = await db.execute({ sql: "SELECT * FROM wishes WHERE id = ?", args: [id] });
  if (wRs.rows.length === 0) return false;
  const w = rowToObj<Wish>(wRs.rows[0] as Row, wRs.columns);
  if (w.status === "purchased" && w.expense_id) {
    await db.execute({ sql: "UPDATE wishes SET expense_id = NULL WHERE id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM expenses WHERE id = ?", args: [w.expense_id] });
  }
  const del = await db.execute({ sql: "DELETE FROM wishes WHERE id = ?", args: [id] });
  return (del.rowsAffected ?? 0) > 0;
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

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  await ensureMigrations();
  const rs = await getDbClient().execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email] });
  return rs.rows.length > 0 ? (rowToObj<UserRow>(rs.rows[0] as Row, rs.columns) as UserRow) : null;
}

export async function getUserByPhone(phone: string): Promise<UserRow | null> {
  await ensureMigrations();
  const rs = await getDbClient().execute({ sql: "SELECT * FROM users WHERE phone = ?", args: [phone] });
  return rs.rows.length > 0 ? (rowToObj<UserRow>(rs.rows[0] as Row, rs.columns) as UserRow) : null;
}

export async function getUserById(id: number): Promise<UserRow | null> {
  await ensureMigrations();
  const rs = await getDbClient().execute({ sql: "SELECT * FROM users WHERE id = ?", args: [id] });
  return rs.rows.length > 0 ? (rowToObj<UserRow>(rs.rows[0] as Row, rs.columns) as UserRow) : null;
}

export async function createUser(u: {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  password_hash: string;
}): Promise<UserRow> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "INSERT INTO users (first_name, last_name, phone, email, password_hash) VALUES (?, ?, ?, ?, ?) RETURNING *",
    args: [u.first_name, u.last_name, u.phone, u.email, u.password_hash],
  });
  return rowToObj<UserRow>(rs.rows[0] as Row, rs.columns);
}

export async function updateUserPassword(id: number, newHash: string): Promise<boolean> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "UPDATE users SET password_hash = ? WHERE id = ?",
    args: [newHash, id],
  });
  return (rs.rowsAffected ?? 0) > 0;
}

export async function updateUserAvatar(id: number, avatarPath: string | null): Promise<boolean> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "UPDATE users SET avatar_path = ? WHERE id = ?",
    args: [avatarPath, id],
  });
  return (rs.rowsAffected ?? 0) > 0;
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
    other_incomes: Array<{ id?: number; month: number; year: number; amount: number }>;
    projects: Project[];
    fixed_charge_payments: FixedChargePayment[];
    loans: Loan[];
    loan_payments: LoanPayment[];
    planned_expenses: PlannedExpense[];
  };
}

export async function exportBackup(): Promise<BackupData> {
  await ensureMigrations();
  const db = getDbClient();
  const [expensesRs, incomesRs, savingsRs, salariesRs, otherIncomesRs, projectsRs, fcpRs, loansRs, loanPayRs, plannedRs] = await Promise.all([
    db.execute("SELECT * FROM expenses ORDER BY id"),
    db.execute("SELECT * FROM incomes ORDER BY id"),
    db.execute("SELECT * FROM savings ORDER BY year, month"),
    db.execute("SELECT * FROM salaries ORDER BY year, month"),
    db.execute("SELECT * FROM other_incomes ORDER BY year, month"),
    db.execute("SELECT * FROM projects ORDER BY id"),
    db.execute("SELECT * FROM fixed_charge_payments ORDER BY id"),
    db.execute("SELECT * FROM loans ORDER BY id"),
    db.execute("SELECT * FROM loan_payments ORDER BY id"),
    db.execute("SELECT * FROM planned_expenses ORDER BY id"),
  ]);
  const config = await getConfig();

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      expenses: rowsToObjs<Expense>(expensesRs.rows as Row[], expensesRs.columns),
      incomes: rowsToObjs<Income>(incomesRs.rows as Row[], incomesRs.columns),
      config,
      savings: rowsToObjs(savingsRs.rows as Row[], savingsRs.columns),
      salaries: rowsToObjs(salariesRs.rows as Row[], salariesRs.columns),
      other_incomes: rowsToObjs(otherIncomesRs.rows as Row[], otherIncomesRs.columns),
      projects: rowsToObjs<Project>(projectsRs.rows as Row[], projectsRs.columns),
      fixed_charge_payments: rowsToObjs<FixedChargePayment>(fcpRs.rows as Row[], fcpRs.columns),
      loans: rowsToObjs<Loan>(loansRs.rows as Row[], loansRs.columns),
      loan_payments: rowsToObjs<LoanPayment>(loanPayRs.rows as Row[], loanPayRs.columns),
      planned_expenses: rowsToObjs<PlannedExpense>(plannedRs.rows as Row[], plannedRs.columns),
    },
  };
}

export async function importBackup(backup: BackupData, userId: number): Promise<{ success: boolean; error?: string }> {
  const data = backup?.data;
  if (!data || typeof data !== "object") {
    return { success: false, error: "Format de sauvegarde invalide" };
  }

  await ensureMigrations();
  const db = getDbClient();
  const tx = await db.transaction("write");
  try {
    const batch: InStatement[] = [
      { sql: "DELETE FROM loan_payments" },
      { sql: "DELETE FROM loans" },
      { sql: "DELETE FROM fixed_charge_payments" },
      { sql: "DELETE FROM planned_expenses" },
      { sql: "DELETE FROM expenses" },
      { sql: "DELETE FROM incomes" },
      { sql: "DELETE FROM savings" },
      { sql: "DELETE FROM salaries" },
      { sql: "DELETE FROM other_incomes" },
      { sql: "DELETE FROM project_purchases" },
      { sql: "DELETE FROM project_funds" },
      { sql: "DELETE FROM projects" },
      { sql: "DELETE FROM config" },
    ];
    if (data.config) {
      batch.push({ sql: "INSERT INTO config (id, data) VALUES (1, ?)", args: [JSON.stringify(data.config)] });
    }
    for (const e of data.expenses || []) {
      batch.push({
        sql: "INSERT INTO expenses (id, user_id, date, time, description, category, amount, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [e.id, userId, e.date, e.time || "00:00", e.description, e.category, e.amount, e.notes || "", e.created_at || new Date().toISOString()],
      });
    }
    for (const i of data.incomes || []) {
      batch.push({
        sql: "INSERT INTO incomes (id, date, time, description, source, amount, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        args: [i.id, i.date, i.time || "00:00", i.description, i.source || "other", i.amount, i.notes || "", i.created_at || new Date().toISOString()],
      });
    }
    for (const s of data.savings || []) {
      batch.push({ sql: "INSERT INTO savings (month, year, amount) VALUES (?, ?, ?)", args: [s.month, s.year, s.amount ?? 0] });
    }
    for (const s of data.salaries || []) {
      batch.push({ sql: "INSERT INTO salaries (month, year, amount) VALUES (?, ?, ?)", args: [s.month, s.year, s.amount ?? 0] });
    }
    for (const o of data.other_incomes || []) {
      batch.push({ sql: "INSERT INTO other_incomes (month, year, amount) VALUES (?, ?, ?)", args: [o.month, o.year, o.amount ?? 0] });
    }
    for (const p of data.projects || []) {
      batch.push({
        sql: "INSERT INTO projects (id, name, description, target_amount, saved_amount, deadline, color, icon, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          p.id,
          p.name,
          p.description || "",
          p.target_amount,
          p.saved_amount ?? 0,
          p.deadline || "",
          p.color || "#6366f1",
          p.icon || "target",
          p.status || "active",
          p.created_at || new Date().toISOString(),
        ],
      });
    }
    for (const l of data.loans || []) {
      batch.push({
        sql: "INSERT INTO loans (id, type, label, lender_borrower, total_amount, remaining_amount, interest_rate, fees, monthly_payment, start_date, end_date, next_due_date, notes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          l.id,
          l.type,
          l.label,
          l.lender_borrower || "",
          l.total_amount,
          l.remaining_amount ?? 0,
          l.interest_rate ?? 0,
          l.fees ?? 0,
          l.monthly_payment ?? 0,
          l.start_date,
          l.end_date || "",
          l.next_due_date || "",
          l.notes || "",
          l.status || "active",
          l.created_at || new Date().toISOString(),
        ],
      });
    }
    for (const lp of data.loan_payments || []) {
      batch.push({
        sql: "INSERT INTO loan_payments (id, loan_id, amount, fees, date, time, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        args: [lp.id, lp.loan_id, lp.amount, lp.fees ?? 0, lp.date, lp.time || "00:00", lp.notes || "", lp.created_at || new Date().toISOString()],
      });
    }
    for (const f of data.fixed_charge_payments || []) {
      batch.push({
        sql: "INSERT INTO fixed_charge_payments (id, charge_id, label, icon, amount, date, time, month, year, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [f.id, f.charge_id, f.label, f.icon || "house", f.amount, f.date, f.time || "00:00", f.month, f.year, f.notes || "", f.created_at || new Date().toISOString()],
      });
    }
    for (const pe of data.planned_expenses || []) {
      batch.push({
        sql: "INSERT INTO planned_expenses (id, due_date, description, category, amount, notes, status, expense_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          pe.id,
          pe.due_date,
          pe.description,
          pe.category,
          pe.amount,
          pe.notes || "",
          pe.status || "pending",
          pe.expense_id ?? null,
          pe.created_at || new Date().toISOString(),
        ],
      });
    }
    await tx.batch(batch);
    await tx.commit();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur lors de la restauration" };
  } finally {
    tx.close();
  }
}

// ── Auto Backup (fichiers locaux uniquement — désactivé sur Turso/Vercel) ──

const BACKUP_DIR = path.join(process.cwd(), "data", "backups");
const LAST_BACKUP_FILE = path.join(process.cwd(), "data", "last_auto_backup.txt");

export async function ensureDailyBackup(): Promise<string | null> {
  if (isTurso() || process.env.TURSO_DATABASE_URL) return null;
  const dir = path.dirname(BACKUP_DIR);
  if (!process.env.TURSO_DATABASE_URL) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const today = new Date().toISOString().slice(0, 10);
  const backupPath = path.join(BACKUP_DIR, `backup-${today}.json`);
  if (fs.existsSync(backupPath)) return backupPath;

  try {
    const backup = await exportBackup();
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), "utf-8");
    fs.writeFileSync(LAST_BACKUP_FILE, today, "utf-8");
    return backupPath;
  } catch {
    return null;
  }
}

export async function getAutoBackupList(): Promise<Array<{ date: string; path: string }>> {
  if (isTurso() || process.env.TURSO_DATABASE_URL || !fs.existsSync(BACKUP_DIR)) return [];
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith("backup-") && f.endsWith(".json"));
  return files
    .map((f) => {
      const m = f.match(/backup-(\d{4}-\d{2}-\d{2})\.json/);
      return m ? { date: m[1], path: path.join(BACKUP_DIR, f) } : null;
    })
    .filter((x): x is { date: string; path: string } => x !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
}
