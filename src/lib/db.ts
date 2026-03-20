import path from "path";
import fs from "fs";
import type { InStatement } from "@libsql/client";
import { getDbClient, isTurso } from "./db/client";
import { Expense, Income, Project, ProjectFund, ProjectPurchase, BudgetConfig, MonthlySaving, FixedChargePayment, Loan, LoanPayment, PlannedExpense, LoanScheduleRow, LoanScheduleInput, Wish, ShoppingList, ShoppingListItem, WishList, WishListItem, Account, AccountTransfer, AccountWithBalance } from "./types";
import type { ScheduleRowUpdate } from "./types";
import {
  DEFAULT_CONFIG,
  accountHasActiveOutgoingLock,
  isBankTreasuryDebitAccount,
  INCOME_SOURCE_SALARY_SETTINGS,
  salarySettingsIncomeNote,
} from "./constants";
import { calculateAccountBalance, checkSufficientBalance } from "./account-balance";

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

const MIGRATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32] as const;

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
        const causeMsg = e instanceof Error && e.cause instanceof Error ? String((e.cause as Error).message) : "";
        const fullMsg = msg + causeMsg;
        if (fullMsg.includes("duplicate column name") || fullMsg.includes("duplicate column")) continue;
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

async function ensurePaymentMethodColumn(): Promise<void> {
  const db = getDbClient();
  try {
    await db.execute({
      sql: "ALTER TABLE expenses ADD COLUMN payment_method TEXT DEFAULT 'cash'",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const causeMsg = e instanceof Error && e.cause instanceof Error ? String((e.cause as Error).message) : "";
    const full = msg + causeMsg;
    if (full.includes("duplicate column") || full.includes("already exists")) return;
    throw e;
  }
}

async function ensureTransactionFeeColumn(): Promise<void> {
  const db = getDbClient();
  try {
    await db.execute({
      sql: "ALTER TABLE expenses ADD COLUMN transaction_fee REAL DEFAULT 0",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const causeMsg = e instanceof Error && e.cause instanceof Error ? String((e.cause as Error).message) : "";
    const full = msg + causeMsg;
    if (full.includes("duplicate column") || full.includes("already exists")) return;
    throw e;
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
    await ensurePaymentMethodColumn();
    await ensureTransactionFeeColumn();
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

// ── Comptes (trésorerie) ──

export async function ensureUserDefaultAccount(userId: number): Promise<number> {
  await ensureMigrations();
  const db = getDbClient();
  const existing = await db.execute({
    sql: "SELECT id FROM accounts WHERE user_id = ? ORDER BY sort_order ASC, id ASC LIMIT 1",
    args: [userId],
  });
  if (existing.rows.length > 0) {
    return Number((existing.rows[0] as Row).id);
  }
  const ins = await db.execute({
    sql: `INSERT INTO accounts (user_id, name, kind, subtype, institution_name, notes, icon, color, logo_url, opening_balance, sort_order) VALUES (?, 'Espèces', 'cash', '', '', 'Compte créé automatiquement', 'banknote', '#10B981', '', 0, 0) RETURNING id`,
    args: [userId],
  });
  const id = Number((ins.rows[0] as Row).id);
  await db.execute({ sql: "UPDATE expenses SET account_id = ? WHERE user_id = ? AND account_id IS NULL", args: [id, userId] });
  return id;
}

export async function getDefaultAccountId(userId: number): Promise<number> {
  return ensureUserDefaultAccount(userId);
}

export async function getAccounts(userId: number): Promise<Account[]> {
  await ensureMigrations();
  await ensureUserDefaultAccount(userId);
  const db = getDbClient();
  const rs = await db.execute({
    sql: "SELECT * FROM accounts WHERE user_id = ? ORDER BY is_archived ASC, sort_order ASC, id ASC",
    args: [userId],
  });
  return rowsToObjs<Account>(rs.rows as Row[], rs.columns);
}

export async function getAccountById(accountId: number, userId: number): Promise<Account | null> {
  await ensureMigrations();
  const db = getDbClient();
  const rs = await db.execute({
    sql: "SELECT * FROM accounts WHERE id = ? AND user_id = ?",
    args: [accountId, userId],
  });
  if (rs.rows.length === 0) return null;
  return rowToObj<Account>(rs.rows[0] as Row, rs.columns);
}

/** Valide que le compte existe et appartient à l’utilisateur (comptabilité stricte). */
export async function validateAccountOwnership(userId: number, accountId: number): Promise<void> {
  await ensureMigrations();
  if (accountId == null || Number(accountId) <= 0) throw new Error("ACCOUNT_ID_REQUIRED");
  const acc = await getAccountById(Number(accountId), userId);
  if (!acc) throw new Error("ACCOUNT_NOT_FOUND");
}

/** Vérifie que le compte peut être débité (coffre non verrouillé). Retourne l’id de compte effectif. */
export async function assertAccountAllowsDebit(
  userId: number,
  accountId: number | null | undefined,
): Promise<number> {
  await ensureMigrations();
  let id = accountId;
  if (id == null || id === undefined || Number.isNaN(Number(id))) {
    id = await getDefaultAccountId(userId);
  }
  const acc = await getAccountById(Number(id), userId);
  if (!acc) throw new Error("ACCOUNT_NOT_FOUND");
  if (accountHasActiveOutgoingLock(acc.kind, acc.vault_unlocks_on)) {
    throw new Error("ACCOUNT_VAULT_LOCKED");
  }
  return Number(id);
}

function isArchivedOrVaultLockedForDebit(acc: Account): boolean {
  return !!acc.is_archived || accountHasActiveOutgoingLock(acc.kind, acc.vault_unlocks_on);
}

/**
 * Compte débité pour un remboursement : prêt bancaire → compte **bancaire** de trésorerie
 * (`isBankTreasuryDebitAccount`, hors épargne bloquée) ; emprunt personnel → compte au choix.
 */
export async function resolveLoanRepaymentDebitAccountId(
  userId: number,
  loan: Loan,
  overrideAccountId?: number | null,
): Promise<number> {
  const accounts = await getAccounts(userId);

  if (loan.type === "bank") {
    const bankTreasury = accounts.filter(
      (a) => isBankTreasuryDebitAccount(a.kind) && !isArchivedOrVaultLockedForDebit(a),
    );
    if (bankTreasury.length === 0) throw new Error("NO_BANK_CURRENT_ACCOUNT");
    const preferred = overrideAccountId ?? loan.payment_account_id ?? null;
    if (preferred != null) {
      const found = bankTreasury.find((a) => a.id === preferred);
      if (!found) throw new Error("INVALID_BANK_CURRENT_ACCOUNT");
      return await assertAccountAllowsDebit(userId, found.id);
    }
    if (bankTreasury.length === 1) return await assertAccountAllowsDebit(userId, bankTreasury[0].id);
    throw new Error("BANK_LOAN_PICK_CURRENT_ACCOUNT");
  }

  if (loan.type === "personal_borrowed") {
    const id = overrideAccountId ?? loan.payment_account_id ?? null;
    if (id != null) {
      const acc = accounts.find((a) => a.id === id);
      if (!acc || isArchivedOrVaultLockedForDebit(acc)) throw new Error("INVALID_REPAYMENT_ACCOUNT");
    }
    return await assertAccountAllowsDebit(userId, id);
  }

  throw new Error("LOAN_REPAYMENT_DEBIT_NOT_APPLICABLE");
}

/** Compte crédité pour un encaissement (argent récupéré sur un prêt personnel fait). */
export async function resolveLoanRecoveryCreditAccountId(
  userId: number,
  loan: Loan,
  overrideAccountId?: number | null,
): Promise<number> {
  const id = overrideAccountId ?? loan.payment_account_id ?? null;
  if (id == null) return getDefaultAccountId(userId);
  const acc = await getAccountById(Number(id), userId);
  if (!acc || acc.is_archived) throw new Error("INVALID_RECOVERY_ACCOUNT");
  return Number(id);
}

export async function getAccountsWithBalances(
  userId: number,
  throughDateInclusive?: string | null,
): Promise<AccountWithBalance[]> {
  const accounts = await getAccounts(userId);
  const through =
    throughDateInclusive && String(throughDateInclusive).trim()
      ? String(throughDateInclusive).trim()
      : undefined;
  const balances = await Promise.all(
    accounts.map((a) => calculateAccountBalance(userId, a.id, through)),
  );
  return accounts.map((a, i) => ({ ...a, balance: balances[i]! }));
}

export async function addAccount(
  userId: number,
  data: Pick<Account, "name" | "kind"> &
    Partial<
      Pick<
        Account,
        | "subtype"
        | "institution_name"
        | "notes"
        | "icon"
        | "color"
        | "logo_url"
        | "opening_balance"
        | "sort_order"
        | "vault_unlocks_on"
      >
    >,
): Promise<Account> {
  await ensureMigrations();
  await ensureUserDefaultAccount(userId);
  const db = getDbClient();
  const maxRs = await db.execute({
    sql: "SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM accounts WHERE user_id = ?",
    args: [userId],
  });
  const nextOrder = Number((maxRs.rows[0] as Row)?.n ?? 0);
  const vaultUntil =
    (data.kind === "vault" || data.kind === "bank_blocked_savings") && data.vault_unlocks_on?.trim()
      ? String(data.vault_unlocks_on).trim()
      : null;
  const rs = await db.execute({
    sql: `INSERT INTO accounts (user_id, name, kind, subtype, institution_name, notes, icon, color, logo_url, opening_balance, is_archived, sort_order, vault_unlocks_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?) RETURNING *`,
    args: [
      userId,
      data.name,
      data.kind,
      data.subtype ?? "",
      data.institution_name ?? "",
      data.notes ?? "",
      data.icon ?? "wallet",
      data.color ?? "#6366f1",
      data.logo_url ?? "",
      data.opening_balance ?? 0,
      data.sort_order ?? nextOrder,
      vaultUntil,
    ],
  });
  return rowToObj<Account>(rs.rows[0] as Row, rs.columns);
}

export async function updateAccount(
  id: number,
  userId: number,
  updates: Partial<
    Pick<
      Account,
      | "name"
      | "kind"
      | "subtype"
      | "institution_name"
      | "notes"
      | "icon"
      | "color"
      | "logo_url"
      | "opening_balance"
      | "is_archived"
      | "sort_order"
      | "vault_unlocks_on"
    >
  >,
): Promise<Account | null> {
  await ensureMigrations();
  const db = getDbClient();
  const curRs = await db.execute({ sql: "SELECT * FROM accounts WHERE id = ? AND user_id = ?", args: [id, userId] });
  if (curRs.rows.length === 0) return null;
  const cur = rowToObj<Account>(curRs.rows[0] as Row, curRs.columns);
  const merged = { ...cur, ...updates };
  await db.execute({
    sql: `UPDATE accounts SET name=?, kind=?, subtype=?, institution_name=?, notes=?, icon=?, color=?, logo_url=?, opening_balance=?, is_archived=?, sort_order=?, vault_unlocks_on=? WHERE id=? AND user_id=?`,
    args: [
      merged.name,
      merged.kind,
      merged.subtype ?? "",
      merged.institution_name ?? "",
      merged.notes ?? "",
      merged.icon ?? "wallet",
      merged.color ?? "#6366f1",
      merged.logo_url ?? "",
      merged.opening_balance,
      merged.is_archived,
      merged.sort_order,
      merged.vault_unlocks_on ?? null,
      id,
      userId,
    ],
  });
  const rs = await db.execute({ sql: "SELECT * FROM accounts WHERE id = ?", args: [id] });
  return rowToObj<Account>(rs.rows[0] as Row, rs.columns);
}

export async function deleteAccount(id: number, userId: number): Promise<{ ok: boolean; reason?: string }> {
  await ensureMigrations();
  const db = getDbClient();
  const acc = await db.execute({ sql: "SELECT id FROM accounts WHERE id = ? AND user_id = ?", args: [id, userId] });
  if (acc.rows.length === 0) return { ok: false, reason: "not_found" };
  const count = await db.execute({ sql: "SELECT COUNT(*) AS c FROM accounts WHERE user_id = ?", args: [userId] });
  if (Number((count.rows[0] as Row).c) <= 1) return { ok: false, reason: "last_account" };
  const e1 = await db.execute({ sql: "SELECT 1 FROM expenses WHERE account_id = ? LIMIT 1", args: [id] });
  if (e1.rows.length > 0) return { ok: false, reason: "has_expenses" };
  const e2 = await db.execute({ sql: "SELECT 1 FROM incomes WHERE account_id = ? LIMIT 1", args: [id] });
  if (e2.rows.length > 0) return { ok: false, reason: "has_incomes" };
  const e3 = await db.execute({
    sql: "SELECT 1 FROM account_transfers WHERE from_account_id = ? OR to_account_id = ? LIMIT 1",
    args: [id, id],
  });
  if (e3.rows.length > 0) return { ok: false, reason: "has_transfers" };
  const e4 = await db.execute({
    sql: "SELECT 1 FROM fixed_charge_payments WHERE account_id = ? LIMIT 1",
    args: [id],
  });
  if (e4.rows.length > 0) return { ok: false, reason: "has_fixed_charges" };
  const e5 = await db.execute({
    sql: "SELECT 1 FROM loan_payments WHERE account_id = ? LIMIT 1",
    args: [id],
  });
  if (e5.rows.length > 0) return { ok: false, reason: "has_loan_payments" };
  const e6 = await db.execute({
    sql: "SELECT 1 FROM project_purchases WHERE account_id = ? LIMIT 1",
    args: [id],
  });
  if (e6.rows.length > 0) return { ok: false, reason: "has_project_purchases" };
  await db.execute({ sql: "DELETE FROM accounts WHERE id = ? AND user_id = ?", args: [id, userId] });
  return { ok: true };
}

export async function addAccountTransfer(
  userId: number,
  fromAccountId: number,
  toAccountId: number,
  amount: number,
  options?: {
    fee?: number;
    fees_account_id?: number | null;
    date?: string;
    time?: string;
    notes?: string;
  },
): Promise<AccountTransfer> {
  await ensureMigrations();
  if (fromAccountId === toAccountId) throw new Error("TRANSFER_SAME_ACCOUNT");
  const db = getDbClient();
  const a1 = await db.execute({ sql: "SELECT id FROM accounts WHERE id = ? AND user_id = ?", args: [fromAccountId, userId] });
  const a2 = await db.execute({ sql: "SELECT id FROM accounts WHERE id = ? AND user_id = ?", args: [toAccountId, userId] });
  if (a1.rows.length === 0 || a2.rows.length === 0) throw new Error("ACCOUNT_NOT_FOUND");
  await assertAccountAllowsDebit(userId, fromAccountId);
  const now = new Date();
  const fee = Math.max(0, Math.round(options?.fee ?? 0));
  let feesAccountId: number | null =
    options?.fees_account_id != null && !Number.isNaN(Number(options.fees_account_id))
      ? Number(options.fees_account_id)
      : null;
  if (feesAccountId != null && (feesAccountId <= 0 || feesAccountId === fromAccountId)) {
    feesAccountId = null;
  }
  const fromPaysFee = fee > 0 && (feesAccountId == null || feesAccountId === fromAccountId);
  const fromTotal = amount + (fromPaysFee ? fee : 0);
  const chkFrom = await checkSufficientBalance(userId, fromAccountId, fromTotal);
  if (!chkFrom.ok) throw new Error("INSUFFICIENT_BALANCE");
  if (feesAccountId != null && fee > 0 && feesAccountId !== fromAccountId) {
    await validateAccountOwnership(userId, feesAccountId);
    await assertAccountAllowsDebit(userId, feesAccountId);
    const chkFee = await checkSufficientBalance(userId, feesAccountId, fee);
    if (!chkFee.ok) throw new Error("INSUFFICIENT_BALANCE");
  }
  const date = options?.date ?? now.toISOString().split("T")[0];
  const time = options?.time ?? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const rs = await db.execute({
    sql: `INSERT INTO account_transfers (user_id, from_account_id, to_account_id, amount, fee, fees_account_id, date, time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    args: [
      userId,
      fromAccountId,
      toAccountId,
      amount,
      fee,
      feesAccountId,
      date,
      time,
      options?.notes ?? "",
    ],
  });
  return rowToObj<AccountTransfer>(rs.rows[0] as Row, rs.columns);
}

export async function getAccountTransfers(userId: number, limit = 100): Promise<AccountTransfer[]> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "SELECT * FROM account_transfers WHERE user_id = ? ORDER BY date DESC, time DESC, id DESC LIMIT ?",
    args: [userId, limit],
  });
  return rowsToObjs<AccountTransfer>(rs.rows as Row[], rs.columns);
}

/** Transferts dont la date tombe dans le mois calendaire (même logique que les dépenses). */
export async function getAccountTransfersForMonth(userId: number, month: number, year: number): Promise<AccountTransfer[]> {
  await ensureMigrations();
  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const endMonth = month === 11 ? 1 : month + 2;
  const endYear = month === 11 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
  const rs = await getDbClient().execute({
    sql: "SELECT * FROM account_transfers WHERE user_id = ? AND date >= ? AND date < ? ORDER BY date DESC, time DESC, id DESC",
    args: [userId, startDate, endDate],
  });
  return rowsToObjs<AccountTransfer>(rs.rows as Row[], rs.columns);
}

export async function deleteAccountTransfer(id: number, userId: number): Promise<boolean> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "DELETE FROM account_transfers WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
  return (rs.rowsAffected ?? 0) > 0;
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
  const fee = exp.transaction_fee ?? 0;
  const accountId = await assertAccountAllowsDebit(userId, exp.account_id);
  await validateAccountOwnership(userId, accountId);
  const totalOut = Number(exp.amount) + Number(fee);
  const chk = await checkSufficientBalance(userId, accountId, totalOut);
  if (!chk.ok) throw new Error("INSUFFICIENT_BALANCE");
  const rs = await db.execute({
    sql: "INSERT INTO expenses (user_id, date, time, description, category, amount, notes, payment_method, transaction_fee, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
    args: [userId, exp.date, exp.time || "00:00", exp.description, exp.category, exp.amount, exp.notes || "", "cash", fee, accountId],
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
    payment_method: "cash",
    transaction_fee: updates.transaction_fee ?? (current as Expense).transaction_fee ?? 0,
    account_id: updates.account_id !== undefined ? updates.account_id : (current as Expense).account_id,
  };
  const uidRs = await db.execute({ sql: "SELECT user_id FROM expenses WHERE id = ?", args: [id] });
  const expenseUserId = uidRs.rows.length ? Number((uidRs.rows[0] as Row).user_id) : null;
  if (expenseUserId != null) {
    const newAcc = await assertAccountAllowsDebit(expenseUserId, m.account_id);
    await validateAccountOwnership(expenseUserId, newAcc);
    const oldAcc = Number((current as Expense).account_id ?? 0);
    const oldFee = Number((current as Expense).transaction_fee ?? 0);
    const oldTotal = Number(current.amount) + oldFee;
    const newTotal = Number(m.amount) + Number(m.transaction_fee ?? 0);
    if (oldAcc === newAcc) {
      const bal = await calculateAccountBalance(expenseUserId, newAcc);
      if (bal + oldTotal - newTotal < 0) throw new Error("INSUFFICIENT_BALANCE");
    } else {
      const chk = await checkSufficientBalance(expenseUserId, newAcc, newTotal);
      if (!chk.ok) throw new Error("INSUFFICIENT_BALANCE");
    }
  }
  await db.execute({
    sql: "UPDATE expenses SET date=?, time=?, description=?, category=?, amount=?, notes=?, payment_method=?, transaction_fee=?, account_id=? WHERE id=?",
    args: [m.date, m.time, m.description, m.category, m.amount, m.notes ?? "", m.payment_method, m.transaction_fee, m.account_id ?? null, id],
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
  await db.execute({ sql: "UPDATE wish_list_items SET expense_id = NULL WHERE expense_id = ?", args: [id] });
  await db.execute({ sql: "UPDATE shopping_list_items SET expense_id = NULL WHERE expense_id = ?", args: [id] });
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

/** Dépenses rattachées à un compte (mouvements du grand livre). */
export async function getExpensesForAccount(userId: number, accountId: number, limit = 300): Promise<Expense[]> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: `SELECT * FROM expenses WHERE account_id = ? AND (user_id = ? OR user_id IS NULL) ORDER BY date DESC, time DESC, id DESC LIMIT ?`,
    args: [accountId, userId, limit],
  });
  return rowsToObjs<Expense>(rs.rows as Row[], rs.columns);
}

/** Revenus rattachés à un compte. */
export async function getIncomesForAccount(accountId: number, limit = 300): Promise<Income[]> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: `SELECT * FROM incomes WHERE account_id = ? ORDER BY date DESC, time DESC, id DESC LIMIT ?`,
    args: [accountId, limit],
  });
  return rowsToObjs<Income>(rs.rows as Row[], rs.columns);
}

/** Transferts où ce compte est source ou destination. */
export async function getAccountTransfersInvolving(userId: number, accountId: number, limit = 200): Promise<AccountTransfer[]> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: `SELECT * FROM account_transfers WHERE user_id = ? AND (from_account_id = ? OR to_account_id = ?) ORDER BY date DESC, time DESC, id DESC LIMIT ?`,
    args: [userId, accountId, accountId, limit],
  });
  return rowsToObjs<AccountTransfer>(rs.rows as Row[], rs.columns);
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

export async function addIncome(inc: Omit<Income, "id" | "created_at">, userId: number): Promise<Income> {
  await ensureMigrations();
  const db = getDbClient();
  const accountId = inc.account_id;
  if (accountId == null || Number(accountId) <= 0) throw new Error("ACCOUNT_ID_REQUIRED");
  await validateAccountOwnership(userId, Number(accountId));
  const rs = await db.execute({
    sql: "INSERT INTO incomes (date, time, description, source, amount, notes, account_id) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
    args: [inc.date, inc.time || "00:00", inc.description, inc.source || "other", inc.amount, inc.notes || "", Number(accountId)],
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

/** Montant déjà enregistré pour ce mois (0 si aucune ligne). `month` : 0–11 comme dans l’UI. */
export async function getSavingRowAmount(month: number, year: number): Promise<number> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "SELECT amount FROM savings WHERE month = ? AND year = ?",
    args: [month, year],
  });
  if (rs.rows.length === 0) return 0;
  return Number((rs.rows[0] as Row).amount ?? 0);
}

/** Compte à débiter pour alimenter le coffre (≠ coffre, débit autorisé). Essaie d’abord le compte par défaut s’il n’est pas le coffre. */
async function resolveOutgoingAccountForVaultTopUp(userId: number, vaultId: number): Promise<number> {
  const defaultId = await getDefaultAccountId(userId);
  const accounts = await getAccounts(userId);
  const tryIds: number[] = [];
  if (defaultId !== vaultId) tryIds.push(defaultId);
  for (const a of accounts) {
    if (!a.is_archived && a.id !== vaultId && !tryIds.includes(a.id)) tryIds.push(a.id);
  }
  for (const id of tryIds) {
    try {
      await assertAccountAllowsDebit(userId, id);
      return id;
    } catch {
      continue;
    }
  }
  throw new Error("NO_DEBIT_ACCOUNT_FOR_SAVINGS");
}

/** Compte qui reçoit l’argent sorti du coffre (≠ coffre). */
async function resolveIncomingAccountForVaultWithdrawal(userId: number, vaultId: number): Promise<number> {
  const defaultId = await getDefaultAccountId(userId);
  if (defaultId !== vaultId) return defaultId;
  const accounts = await getAccounts(userId);
  const other = accounts.find((a) => !a.is_archived && a.id !== vaultId);
  if (!other) throw new Error("NO_ACCOUNT_FOR_SAVINGS_RETURN");
  return other.id;
}

/**
 * Enregistre l’épargne mensuelle et, si un coffre fonds d’urgence est configuré (`emergency_fund_account_id`),
 * crée un transfert pour refléter le delta (compte par défaut ↔ coffre).
 */
export async function setSavingAndSyncEmergencyVault(
  userId: number,
  month: number,
  year: number,
  amount: number,
): Promise<void> {
  await ensureMigrations();
  const newAmount = Math.max(0, Math.round(Number(amount)));
  const prev = await getSavingRowAmount(month, year);
  const delta = newAmount - prev;

  const config = await getConfig();
  const vaultIdRaw = config.emergency_fund_account_id;
  const vaultId =
    vaultIdRaw != null && !Number.isNaN(Number(vaultIdRaw)) ? Number(vaultIdRaw) : null;

  if (delta === 0) {
    await setSaving(month, year, newAmount);
    return;
  }

  if (vaultId == null) {
    await setSaving(month, year, newAmount);
    return;
  }

  const vault = await getAccountById(vaultId, userId);
  if (!vault || vault.kind !== "vault") {
    await setSaving(month, year, newAmount);
    return;
  }

  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const monthLabel = `${month + 1}`.padStart(2, "0");
  const notes = `Épargne mensuelle ${monthLabel}/${year}`;

  const db = getDbClient();
  const tx = await db.transaction("write");
  try {
    if (delta > 0) {
      const fromId = await resolveOutgoingAccountForVaultTopUp(userId, vaultId);
      await tx.execute({
        sql: `INSERT INTO account_transfers (user_id, from_account_id, to_account_id, amount, fee, date, time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [userId, fromId, vaultId, delta, 0, date, time, notes],
      });
    } else {
      const out = -delta;
      await assertAccountAllowsDebit(userId, vaultId);
      const toId = await resolveIncomingAccountForVaultWithdrawal(userId, vaultId);
      await tx.execute({
        sql: `INSERT INTO account_transfers (user_id, from_account_id, to_account_id, amount, fee, date, time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [userId, vaultId, toId, out, 0, date, time, `${notes} (ajustement)`],
      });
    }
    await tx.execute({
      sql: "INSERT INTO savings (month, year, amount) VALUES (?, ?, ?) ON CONFLICT(month, year) DO UPDATE SET amount = excluded.amount",
      args: [month, year, newAmount],
    });
    await tx.commit();
  } finally {
    tx.close();
  }
}

// ── Salaries ──

export type SalariesYearData = { amounts: number[]; accountIds: (number | null)[] };

export async function getSalaries(year: number): Promise<SalariesYearData> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "SELECT month, amount, account_id FROM salaries WHERE year = ? ORDER BY month",
    args: [year],
  });
  const rows = rowsToObjs<{ month: number; amount: number; account_id?: number | null }>(
    rs.rows as Row[],
    rs.columns,
  );
  const amounts = Array(12).fill(0) as number[];
  const accountIds: (number | null)[] = Array(12).fill(null);
  rows.forEach((r) => {
    amounts[r.month] = r.amount;
    const raw = r.account_id;
    const n = raw != null ? Number(raw) : NaN;
    accountIds[r.month] = Number.isFinite(n) ? n : null;
  });
  return { amounts, accountIds };
}

export async function setSalary(
  month: number,
  year: number,
  amount: number,
  accountId?: number | null,
): Promise<void> {
  await ensureMigrations();
  await getDbClient().execute({
    sql: `INSERT INTO salaries (month, year, amount, account_id) VALUES (?, ?, ?, ?)
      ON CONFLICT(month, year) DO UPDATE SET amount = excluded.amount, account_id = excluded.account_id`,
    args: [month, year, amount, accountId ?? null],
  });
}

/**
 * Synchronise un revenu `incomes` avec le salaire des réglages pour créditer le compte (trésorerie).
 * Supprimé si montant 0 ou pas de compte. Exclu des totaux budget via `source === salary_settings`.
 */
export async function syncSalaryLinkedIncome(
  year: number,
  month: number,
  amount: number,
  accountId: number | null,
): Promise<void> {
  await ensureMigrations();
  const db = getDbClient();
  const note = salarySettingsIncomeNote(year, month);
  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const existing = await db.execute({
    sql: "SELECT id FROM incomes WHERE notes = ? LIMIT 1",
    args: [note],
  });

  if (amount <= 0 || accountId == null) {
    if (existing.rows.length > 0) {
      const id = Number((existing.rows[0] as Row).id);
      await deleteIncome(id);
    }
    return;
  }

  const amt = Math.max(0, Math.round(amount));

  if (existing.rows.length > 0) {
    const id = Number((existing.rows[0] as Row).id);
    await db.execute({
      sql: `UPDATE incomes SET amount = ?, account_id = ?, date = ?, time = '00:00', description = ?, source = ?, notes = ? WHERE id = ?`,
      args: [
        amt,
        accountId,
        dateStr,
        "Salaire (réglages)",
        INCOME_SOURCE_SALARY_SETTINGS,
        note,
        id,
      ],
    });
    return;
  }

  await db.execute({
    sql: `INSERT INTO incomes (date, time, description, source, amount, notes, account_id) VALUES (?, '00:00', ?, ?, ?, ?, ?)`,
    args: [
      dateStr,
      "Salaire (réglages)",
      INCOME_SOURCE_SALARY_SETTINGS,
      amt,
      note,
      accountId,
    ],
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
    sql: `INSERT INTO loans (type, label, lender_borrower, total_amount, remaining_amount, interest_rate, fees, monthly_payment, start_date, end_date, next_due_date, notes, status, bank_name, agency, loan_number, first_payment_date, payment_day, total_payments, paid_payments, insurance_rate, tax_rate, fees_amount, payment_account_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
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
      l.payment_account_id ?? null,
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
  const paymentAccountId =
    updates.payment_account_id !== undefined ? updates.payment_account_id : (current as Loan).payment_account_id ?? null;
  await db.execute({
    sql: `UPDATE loans SET type=?, label=?, lender_borrower=?, total_amount=?, remaining_amount=?, interest_rate=?, fees=?, monthly_payment=?, start_date=?, end_date=?, next_due_date=?, notes=?, status=?, paid_payments=?,
      bank_name=?, agency=?, loan_number=?, first_payment_date=?, payment_day=?, total_payments=?, insurance_rate=?, tax_rate=?, fees_amount=?, effective_rate=?, payment_account_id=? WHERE id=?`,
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
      m.bank_name ?? "",
      m.agency ?? "",
      m.loan_number ?? "",
      m.first_payment_date ?? "",
      m.payment_day ?? 25,
      m.total_payments ?? 0,
      m.insurance_rate ?? 0,
      m.tax_rate ?? 0,
      m.fees_amount ?? 0,
      m.effective_rate ?? 0,
      paymentAccountId,
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
      const paidAt = r.paid_at ?? null;
      const paidAmount = r.paid_amount ?? null;
      const expenseId = r.expense_id ?? null;
      await tx.execute({
        sql: `INSERT INTO loan_schedule (user_id, loan_id, number, due_date, principal, interest, insurance, tax_interest, tax_insurance, fees, total_payment, remaining_balance, status, paid_at, paid_amount, expense_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          paidAt,
          paidAmount,
          expenseId,
        ],
      });
    }
    await tx.commit();
  } finally {
    tx.close();
  }
}

export async function markSchedulePaid(loanId: number, scheduleNumber: number, note?: string, paidAmount?: number): Promise<LoanScheduleRow | null> {
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
    const amountToStore = paidAmount ?? row.total_payment;
    await tx.execute({
      sql: "UPDATE loan_schedule SET status = 'paid', paid_at = ?, payment_note = ?, paid_amount = ? WHERE loan_id = ? AND number = ?",
      args: [now, note ?? "", amountToStore, loanId, scheduleNumber],
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

export async function updateScheduleRow(loanId: number, scheduleNumber: number, updates: ScheduleRowUpdate): Promise<LoanScheduleRow | null> {
  await ensureMigrations();
  const db = getDbClient();
  const rs = await db.execute({
    sql: "SELECT * FROM loan_schedule WHERE loan_id = ? AND number = ?",
    args: [loanId, scheduleNumber],
  });
  if (rs.rows.length === 0) return null;
  const row = rowToObj<LoanScheduleRow>(rs.rows[0] as Row, rs.columns);

  const allowed = ["due_date", "principal", "interest", "insurance", "tax_interest", "tax_insurance", "fees", "total_payment", "remaining_balance", "paid_amount"] as const;
  const setParts: string[] = [];
  const args: (string | number)[] = [];
  for (const k of allowed) {
    const v = updates[k];
    if (v !== undefined && v !== null) {
      setParts.push(`${k} = ?`);
      args.push(typeof v === "number" ? v : String(v));
    }
  }
  if (setParts.length === 0) return row;

  args.push(loanId, scheduleNumber);
  await db.execute({
    sql: `UPDATE loan_schedule SET ${setParts.join(", ")} WHERE loan_id = ? AND number = ?`,
    args,
  });

  if (row.expense_id && (updates.total_payment !== undefined || updates.paid_amount !== undefined)) {
    const newAmount = updates.paid_amount ?? updates.total_payment ?? row.total_payment;
    await db.execute({
      sql: "UPDATE expenses SET amount = ? WHERE id = ?",
      args: [newAmount, row.expense_id],
    });
  }

  const updatedRs = await db.execute({
    sql: "SELECT * FROM loan_schedule WHERE loan_id = ? AND number = ?",
    args: [loanId, scheduleNumber],
  });
  return rowToObj<LoanScheduleRow>(updatedRs.rows[0] as Row, updatedRs.columns);
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
      sql: "UPDATE loan_schedule SET status = 'pending', paid_at = NULL, payment_note = '', expense_id = NULL, paid_amount = NULL WHERE loan_id = ? AND number = ?",
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

export async function updateLoanPaymentExpenseId(
  paymentId: number,
  expenseId: number,
  accountId?: number | null,
): Promise<void> {
  await ensureMigrations();
  if (accountId != null && Number(accountId) > 0) {
    await getDbClient().execute({
      sql: "UPDATE loan_payments SET expense_id = ?, account_id = ? WHERE id = ?",
      args: [expenseId, Number(accountId), paymentId],
    });
  } else {
    await getDbClient().execute({
      sql: "UPDATE loan_payments SET expense_id = ? WHERE id = ?",
      args: [expenseId, paymentId],
    });
  }
}

export async function updateLoanPaymentIncomeId(
  paymentId: number,
  incomeId: number,
  accountId?: number | null,
): Promise<void> {
  await ensureMigrations();
  if (accountId != null && Number(accountId) > 0) {
    await getDbClient().execute({
      sql: "UPDATE loan_payments SET income_id = ?, account_id = ? WHERE id = ?",
      args: [incomeId, Number(accountId), paymentId],
    });
  } else {
    await getDbClient().execute({
      sql: "UPDATE loan_payments SET income_id = ? WHERE id = ?",
      args: [incomeId, paymentId],
    });
  }
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
    const payAcc = (p as LoanPayment).account_id != null && Number((p as LoanPayment).account_id) > 0 ? Number((p as LoanPayment).account_id) : 0;
    const ins = await tx.execute({
      sql: "INSERT INTO loan_payments (loan_id, amount, fees, date, time, notes, account_id) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
      args: [p.loan_id, p.amount, p.fees || 0, p.date, p.time || "00:00", p.notes || "", payAcc],
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
  userId: number,
  payments: Array<{
    amount: number;
    fees: number;
    date: string;
    time: string;
    notes: string;
    account_id?: number;
  }>,
): Promise<number> {
  await ensureMigrations();
  const db = getDbClient();
  const loanRow = await getLoan(loanId);
  if (!loanRow) throw new Error("LOAN_NOT_FOUND");
  const tx = await db.transaction("write");
  try {
    let totalDeducted = 0;
    for (const p of payments) {
      let acc =
        p.account_id != null && p.account_id > 0
          ? p.account_id
          : loanRow.payment_account_id != null
            ? Number(loanRow.payment_account_id)
            : await getDefaultAccountId(userId);
      if (!acc || acc <= 0) acc = await getDefaultAccountId(userId);
      if (loanRow.type === "bank" || loanRow.type === "personal_borrowed") {
        acc = await resolveLoanRepaymentDebitAccountId(userId, loanRow, acc);
        const totalOut = p.amount + (p.fees || 0);
        const chk = await checkSufficientBalance(userId, acc, totalOut);
        if (!chk.ok) throw new Error("INSUFFICIENT_BALANCE");
      }
      await tx.execute({
        sql: "INSERT INTO loan_payments (loan_id, amount, fees, date, time, notes, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [loanId, p.amount, p.fees || 0, p.date, p.time || "00:00", p.notes || "", acc],
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

export async function ensureRecurringPayments(userId: number, month: number, year: number): Promise<number> {
  const now = new Date();
  if (month !== now.getMonth() || year !== now.getFullYear()) return 0;

  const config = await getConfig();
  const existing = await getFixedChargePayments(month, year);
  const existingChargeIds = new Set(existing.map((p) => p.charge_id));
  let created = 0;
  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;

  for (const ch of config.fixedCharges || []) {
    if (ch.amount <= 0 || existingChargeIds.has(ch.id)) continue;
    try {
      await addFixedChargePayment(
        {
          charge_id: ch.id,
          label: ch.label,
          icon: ch.icon || "house",
          amount: ch.amount,
          date: dateStr,
          time: "00:00",
          month,
          year,
          notes: "Créé automatiquement",
        },
        userId,
      );
      existingChargeIds.add(ch.id);
      created++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      /* Ne pas faire échouer un simple GET (liste du mois) si solde insuffisant ou compte bloqué. */
      console.warn(
        `[ensureRecurringPayments] charge ${ch.id} (${ch.label}) non créée — ${msg}`,
      );
    }
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

export async function addFixedChargePayment(
  p: Omit<FixedChargePayment, "id" | "created_at">,
  userId: number,
): Promise<FixedChargePayment> {
  await ensureMigrations();
  let accId = p.account_id != null && Number(p.account_id) > 0 ? Number(p.account_id) : await getDefaultAccountId(userId);
  await validateAccountOwnership(userId, accId);
  await assertAccountAllowsDebit(userId, accId);
  const chk = await checkSufficientBalance(userId, accId, p.amount);
  if (!chk.ok) throw new Error("INSUFFICIENT_BALANCE");
  const rs = await getDbClient().execute({
    sql: "INSERT INTO fixed_charge_payments (charge_id, label, icon, amount, date, time, month, year, notes, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
    args: [p.charge_id, p.label, p.icon, p.amount, p.date, p.time || "00:00", p.month, p.year, p.notes || "", accId],
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
    sql: "INSERT INTO projects (name, description, target_amount, saved_amount, deadline, color, icon, status, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
    args: [
      p.name,
      p.description,
      p.target_amount,
      p.saved_amount || 0,
      p.deadline,
      p.color,
      p.icon,
      p.status || "active",
      p.account_id ?? null,
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
    sql: "UPDATE projects SET name=?, description=?, target_amount=?, saved_amount=?, deadline=?, color=?, icon=?, status=?, account_id=? WHERE id=?",
    args: [
      merged.name,
      merged.description,
      merged.target_amount,
      merged.saved_amount,
      merged.deadline,
      merged.color,
      merged.icon,
      merged.status,
      merged.account_id ?? null,
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
  f: Omit<ProjectFund, "id" | "created_at"> & { income_id?: number | null; from_account_id?: number | null },
): Promise<ProjectFund> {
  await ensureMigrations();
  const db = getDbClient();
  const srcAcc =
    f.from_account_id != null && Number(f.from_account_id) > 0
      ? Number(f.from_account_id)
      : f.account_id != null && Number(f.account_id) > 0
        ? Number(f.account_id)
        : 0;
  const rs = await db.execute({
    sql: "INSERT INTO project_funds (project_id, amount, date, notes, income_id, from_account_id, account_id) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
    args: [f.project_id, f.amount, f.date, f.notes || "", f.income_id ?? null, f.from_account_id ?? null, srcAcc],
  });
  const fund = rowToObj<ProjectFund>(rs.rows[0] as Row, rs.columns);
  await syncProjectSavedAmount(f.project_id);
  return fund;
}

/**
 * Versement vers un projet : transfert compte source → compte du projet, + ligne project_funds.
 */
export async function addProjectFundWithTransfer(
  userId: number,
  params: {
    project_id: number;
    amount: number;
    date: string;
    notes?: string;
    from_account_id: number;
  },
): Promise<ProjectFund> {
  await ensureMigrations();
  const project = await getProject(params.project_id);
  if (!project) throw new Error("PROJECT_NOT_FOUND");
  if (project.account_id == null || Number.isNaN(Number(project.account_id))) {
    throw new Error("PROJECT_NO_ACCOUNT");
  }
  const destId = Number(project.account_id);
  const fromId = Number(params.from_account_id);
  if (fromId === destId) throw new Error("TRANSFER_SAME_ACCOUNT");
  const amt = Math.round(Number(params.amount));
  if (!amt || amt <= 0) throw new Error("INVALID_AMOUNT");

  await assertAccountAllowsDebit(userId, fromId);
  const srcAcc = await getAccountById(fromId, userId);
  const dstAcc = await getAccountById(destId, userId);
  if (!srcAcc || !dstAcc) throw new Error("ACCOUNT_NOT_FOUND");

  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const xferNote = `Projet: ${project.name}${params.notes?.trim() ? ` — ${params.notes.trim()}` : ""}`;

  const db = getDbClient();
  const tx = await db.transaction("write");
  let fund: ProjectFund;
  try {
    await tx.execute({
      sql: `INSERT INTO account_transfers (user_id, from_account_id, to_account_id, amount, fee, date, time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [userId, fromId, destId, amt, 0, params.date, time, xferNote],
    });
    const fundRs = await tx.execute({
      sql: "INSERT INTO project_funds (project_id, amount, date, notes, income_id, from_account_id, account_id) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
      args: [params.project_id, amt, params.date, params.notes?.trim() || "", null, fromId, fromId],
    });
    fund = rowToObj<ProjectFund>(fundRs.rows[0] as Row, fundRs.columns);
    await tx.commit();
  } finally {
    tx.close();
  }
  await syncProjectSavedAmount(params.project_id);
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
  const current = rowToObj<ProjectFund & { income_id?: number | null; from_account_id?: number | null }>(
    currentRs.rows[0] as Row,
    currentRs.columns,
  );
  if (
    current.from_account_id != null &&
    (updates.amount !== undefined || updates.date !== undefined)
  ) {
    throw new Error("PROJECT_FUND_TRANSFER_LOCKED");
  }
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

export async function deleteProjectFund(id: number, userId: number): Promise<boolean> {
  await ensureMigrations();
  const db = getDbClient();
  const fundRs = await db.execute({ sql: "SELECT * FROM project_funds WHERE id = ?", args: [id] });
  if (fundRs.rows.length === 0) return false;
  const fund = rowToObj<ProjectFund & { income_id?: number | null; from_account_id?: number | null }>(
    fundRs.rows[0] as Row,
    fundRs.columns,
  );
  const project = await getProject(fund.project_id);
  if (fund.from_account_id != null && project?.account_id != null) {
    await assertAccountAllowsDebit(userId, Number(project.account_id));
    await addAccountTransfer(
      userId,
      Number(project.account_id),
      Number(fund.from_account_id),
      fund.amount,
      { notes: `Annulation versement projet: ${project.name}` },
    );
  } else if (fund.income_id) {
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

export async function addProjectPurchase(
  p: Omit<ProjectPurchase, "id" | "created_at">,
  userId: number,
): Promise<ProjectPurchase> {
  await ensureMigrations();
  const linkedExp = p.expense_id != null && Number(p.expense_id) > 0;
  let accId =
    p.account_id != null && Number(p.account_id) > 0 ? Number(p.account_id) : 0;
  if (!linkedExp) {
    if (!accId) throw new Error("ACCOUNT_ID_REQUIRED");
    await validateAccountOwnership(userId, accId);
    await assertAccountAllowsDebit(userId, accId);
    const chk = await checkSufficientBalance(userId, accId, p.amount);
    if (!chk.ok) throw new Error("INSUFFICIENT_BALANCE");
  } else {
    accId = 0;
  }
  const db = getDbClient();
  const rs = await db.execute({
    sql: "INSERT INTO project_purchases (project_id, description, amount, date, expense_id, account_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
    args: [p.project_id, p.description, p.amount, p.date, p.expense_id ?? null, accId],
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
  const accId = p.account_id != null && Number(p.account_id) > 0 ? Number(p.account_id) : 0;
  const rs = await getDbClient().execute({
    sql: "INSERT INTO planned_expenses (due_date, description, category, amount, notes, status, account_id) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
    args: [p.due_date, p.description, p.category, p.amount, p.notes || "", p.status || "pending", accId],
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
  const accRaw = updates.account_id !== undefined ? updates.account_id : merged.account_id;
  const accId = accRaw != null && Number(accRaw) > 0 ? Number(accRaw) : 0;
  await db.execute({
    sql: "UPDATE planned_expenses SET due_date=?, description=?, category=?, amount=?, notes=?, account_id=? WHERE id=?",
    args: [merged.due_date, merged.description, merged.category, merged.amount, merged.notes || "", accId, id],
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
  const prefAcc = p.account_id != null && Number(p.account_id) > 0 ? Number(p.account_id) : null;
  const accId = prefAcc ?? (await getDefaultAccountId(userId));
  await assertAccountAllowsDebit(userId, accId);
  const chk = await checkSufficientBalance(userId, accId, p.amount);
  if (!chk.ok) throw new Error("INSUFFICIENT_BALANCE");
  const ins = await db.execute({
    sql: "INSERT INTO expenses (user_id, date, time, description, category, amount, notes, payment_method, transaction_fee, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'cash', 0, ?) RETURNING *",
    args: [userId, today, time, p.description, p.category, p.amount, p.notes ? `[Planifié] ${p.notes}` : "[Planifié]", accId],
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
  const defaultAcc = await getDefaultAccountId(userId);
  const tx = await db.transaction("write");
  try {
    for (const p of due) {
      const useAcc =
        p.account_id != null && Number(p.account_id) > 0 ? Number(p.account_id) : defaultAcc;
      await assertAccountAllowsDebit(userId, useAcc);
      const chk = await checkSufficientBalance(userId, useAcc, p.amount);
      if (!chk.ok) throw new Error("INSUFFICIENT_BALANCE");
      const ins = await tx.execute({
        sql: "INSERT INTO expenses (user_id, date, time, description, category, amount, notes, payment_method, transaction_fee, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'cash', 0, ?) RETURNING *",
        args: [userId, p.due_date, "00:00", p.description, p.category, p.amount, p.notes ? `[Planifié] ${p.notes}` : "[Planifié]", useAcc],
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

export async function markWishPurchased(id: number, actualAmount: number, userId: number, transactionFee = 0, accountId?: number | null): Promise<Expense | null> {
  await ensureMigrations();
  const db = getDbClient();
  const wRs = await db.execute({ sql: "SELECT * FROM wishes WHERE id = ? AND status = 'pending'", args: [id] });
  if (wRs.rows.length === 0) return null;
  const w = rowToObj<Wish>(wRs.rows[0] as Row, wRs.columns);
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const acc = accountId ?? (await getDefaultAccountId(userId));
  await assertAccountAllowsDebit(userId, acc);
  const ins = await db.execute({
    sql: "INSERT INTO expenses (user_id, date, time, description, category, amount, notes, payment_method, transaction_fee, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
    args: [userId, today, time, w.name, w.category, actualAmount, w.notes ? `[Envie achetée] ${w.notes}` : "[Envie achetée]", "cash", transactionFee, acc],
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

// ── Shopping lists (listes de courses) ──

export async function getShoppingLists(month?: number, year?: number): Promise<ShoppingList[]> {
  await ensureMigrations();
  const db = getDbClient();
  if (month != null && year != null) {
    const m = month + 1;
    const start = `${year}-${String(m).padStart(2, "0")}-01`;
    const endDate = new Date(year, month + 1, 0);
    const end = `${year}-${String(m).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
    const rs = await db.execute({
      sql: "SELECT * FROM shopping_lists WHERE scheduled_date >= ? AND scheduled_date <= ? ORDER BY scheduled_date ASC, created_at ASC",
      args: [start, end],
    });
    return rowsToObjs<ShoppingList>(rs.rows as Row[], rs.columns);
  }
  const rs = await db.execute("SELECT * FROM shopping_lists ORDER BY scheduled_date ASC, created_at ASC");
  return rowsToObjs<ShoppingList>(rs.rows as Row[], rs.columns);
}

export async function addShoppingList(list: Omit<ShoppingList, "id" | "created_at">): Promise<ShoppingList> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "INSERT INTO shopping_lists (name, scheduled_date) VALUES (?, ?) RETURNING *",
    args: [list.name, list.scheduled_date],
  });
  return rowToObj<ShoppingList>(rs.rows[0] as Row, rs.columns);
}

export async function updateShoppingList(id: number, updates: Partial<Pick<ShoppingList, "name" | "scheduled_date">>): Promise<ShoppingList | null> {
  await ensureMigrations();
  const db = getDbClient();
  const currentRs = await db.execute({ sql: "SELECT * FROM shopping_lists WHERE id = ?", args: [id] });
  if (currentRs.rows.length === 0) return null;
  const current = rowToObj<ShoppingList>(currentRs.rows[0] as Row, currentRs.columns);
  const merged = { ...current, ...updates };
  await db.execute({
    sql: "UPDATE shopping_lists SET name=?, scheduled_date=? WHERE id=?",
    args: [merged.name, merged.scheduled_date, id],
  });
  const rs = await db.execute({ sql: "SELECT * FROM shopping_lists WHERE id = ?", args: [id] });
  return rowToObj<ShoppingList>(rs.rows[0] as Row, rs.columns);
}

export async function deleteShoppingList(id: number): Promise<boolean> {
  await ensureMigrations();
  const db = getDbClient();
  const itemsRs = await db.execute({ sql: "SELECT * FROM shopping_list_items WHERE list_id = ? AND expense_id IS NOT NULL", args: [id] });
  const items = rowsToObjs<ShoppingListItem>(itemsRs.rows as Row[], itemsRs.columns);
  for (const item of items) {
    if (item.expense_id) {
      await db.execute({ sql: "UPDATE shopping_list_items SET expense_id = NULL WHERE id = ?", args: [item.id] });
      await db.execute({ sql: "DELETE FROM expenses WHERE id = ?", args: [item.expense_id] });
    }
  }
  const del = await db.execute({ sql: "DELETE FROM shopping_lists WHERE id = ?", args: [id] });
  return (del.rowsAffected ?? 0) > 0;
}

export async function getPendingShoppingListItems(): Promise<Array<ShoppingListItem & { scheduled_date: string }>> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: `SELECT i.*, l.scheduled_date as scheduled_date
      FROM shopping_list_items i
      JOIN shopping_lists l ON i.list_id = l.id
      WHERE i.status = 'pending'
      ORDER BY l.scheduled_date ASC, i.created_at ASC`,
    args: [],
  });
  return rowsToObjs<ShoppingListItem & { scheduled_date: string }>(rs.rows as Row[], rs.columns);
}

export async function getPurchasedShoppingListItemsByDateRange(start: string, end: string): Promise<ShoppingListItem[]> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: `SELECT * FROM shopping_list_items
      WHERE status = 'purchased' AND purchased_at IS NOT NULL
      AND date(purchased_at) >= ? AND date(purchased_at) <= ?
      ORDER BY purchased_at ASC`,
    args: [start, end],
  });
  return rowsToObjs<ShoppingListItem>(rs.rows as Row[], rs.columns);
}

export async function getShoppingListItems(listId: number): Promise<ShoppingListItem[]> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "SELECT * FROM shopping_list_items WHERE list_id = ? ORDER BY status ASC, created_at ASC",
    args: [listId],
  });
  return rowsToObjs<ShoppingListItem>(rs.rows as Row[], rs.columns);
}

export async function addShoppingListItem(item: Omit<ShoppingListItem, "id" | "created_at">): Promise<ShoppingListItem> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "INSERT INTO shopping_list_items (list_id, name, category, estimated_amount, actual_amount, status, purchased_at, expense_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
    args: [item.list_id, item.name, item.category || "food", item.estimated_amount, item.actual_amount ?? null, item.status || "pending", item.purchased_at ?? null, item.expense_id ?? null],
  });
  return rowToObj<ShoppingListItem>(rs.rows[0] as Row, rs.columns);
}

export async function updateShoppingListItem(id: number, updates: Partial<Pick<ShoppingListItem, "name" | "category" | "estimated_amount">>): Promise<ShoppingListItem | null> {
  await ensureMigrations();
  const db = getDbClient();
  const currentRs = await db.execute({ sql: "SELECT * FROM shopping_list_items WHERE id = ?", args: [id] });
  if (currentRs.rows.length === 0) return null;
  const current = rowToObj<ShoppingListItem>(currentRs.rows[0] as Row, currentRs.columns);
  const merged = { ...current, ...updates };
  await db.execute({
    sql: "UPDATE shopping_list_items SET name=?, category=?, estimated_amount=? WHERE id=?",
    args: [merged.name, merged.category || "food", merged.estimated_amount, id],
  });
  const rs = await db.execute({ sql: "SELECT * FROM shopping_list_items WHERE id = ?", args: [id] });
  return rowToObj<ShoppingListItem>(rs.rows[0] as Row, rs.columns);
}

export async function markShoppingItemPurchased(id: number, actualAmount: number, userId: number, transactionFee = 0, accountId?: number | null): Promise<Expense | null> {
  await ensureMigrations();
  const db = getDbClient();
  const itemRs = await db.execute({ sql: "SELECT * FROM shopping_list_items WHERE id = ? AND status = 'pending'", args: [id] });
  if (itemRs.rows.length === 0) return null;
  const item = rowToObj<ShoppingListItem>(itemRs.rows[0] as Row, itemRs.columns);
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const purchasedAt = now.toISOString();
  const category = item.category || "food";
  const acc = accountId ?? (await getDefaultAccountId(userId));
  await assertAccountAllowsDebit(userId, acc);
  const ins = await db.execute({
    sql: "INSERT INTO expenses (user_id, date, time, description, category, amount, notes, payment_method, transaction_fee, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
    args: [userId, date, time, item.name, category, actualAmount, `[Liste de courses] ${item.name}`, "cash", transactionFee, acc],
  });
  const expense = rowToObj<Expense>(ins.rows[0] as Row, ins.columns);
  await db.execute({
    sql: "UPDATE shopping_list_items SET status = 'purchased', actual_amount = ?, purchased_at = ?, expense_id = ? WHERE id = ?",
    args: [actualAmount, purchasedAt, expense.id, id],
  });
  return expense;
}

export async function deleteShoppingListItem(id: number): Promise<boolean> {
  await ensureMigrations();
  const db = getDbClient();
  const itemRs = await db.execute({ sql: "SELECT * FROM shopping_list_items WHERE id = ?", args: [id] });
  if (itemRs.rows.length === 0) return false;
  const item = rowToObj<ShoppingListItem>(itemRs.rows[0] as Row, itemRs.columns);
  if (item.status === "purchased" && item.expense_id) {
    await db.execute({ sql: "UPDATE shopping_list_items SET expense_id = NULL WHERE id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM expenses WHERE id = ?", args: [item.expense_id] });
  }
  const del = await db.execute({ sql: "DELETE FROM shopping_list_items WHERE id = ?", args: [id] });
  return (del.rowsAffected ?? 0) > 0;
}

// ── Wish lists (listes d'envies) ──

export async function getWishLists(month?: number, year?: number): Promise<WishList[]> {
  await ensureMigrations();
  const db = getDbClient();
  if (month != null && year != null) {
    const m = month + 1;
    const start = `${year}-${String(m).padStart(2, "0")}-01`;
    const endDate = new Date(year, month + 1, 0);
    const end = `${year}-${String(m).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
    const rs = await db.execute({
      sql: "SELECT * FROM wish_lists WHERE scheduled_date >= ? AND scheduled_date <= ? ORDER BY scheduled_date ASC, created_at ASC",
      args: [start, end],
    });
    return rowsToObjs<WishList>(rs.rows as Row[], rs.columns);
  }
  const rs = await db.execute("SELECT * FROM wish_lists ORDER BY scheduled_date ASC, created_at ASC");
  return rowsToObjs<WishList>(rs.rows as Row[], rs.columns);
}

export async function addWishList(list: Omit<WishList, "id" | "created_at">): Promise<WishList> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "INSERT INTO wish_lists (name, scheduled_date) VALUES (?, ?) RETURNING *",
    args: [list.name, list.scheduled_date],
  });
  return rowToObj<WishList>(rs.rows[0] as Row, rs.columns);
}

export async function updateWishList(id: number, updates: Partial<Pick<WishList, "name" | "scheduled_date">>): Promise<WishList | null> {
  await ensureMigrations();
  const db = getDbClient();
  const currentRs = await db.execute({ sql: "SELECT * FROM wish_lists WHERE id = ?", args: [id] });
  if (currentRs.rows.length === 0) return null;
  const current = rowToObj<WishList>(currentRs.rows[0] as Row, currentRs.columns);
  const merged = { ...current, ...updates };
  await db.execute({
    sql: "UPDATE wish_lists SET name=?, scheduled_date=? WHERE id=?",
    args: [merged.name, merged.scheduled_date, id],
  });
  const rs = await db.execute({ sql: "SELECT * FROM wish_lists WHERE id = ?", args: [id] });
  return rowToObj<WishList>(rs.rows[0] as Row, rs.columns);
}

export async function deleteWishList(id: number): Promise<boolean> {
  await ensureMigrations();
  const db = getDbClient();
  const itemsRs = await db.execute({ sql: "SELECT * FROM wish_list_items WHERE list_id = ? AND expense_id IS NOT NULL", args: [id] });
  const items = rowsToObjs<WishListItem>(itemsRs.rows as Row[], itemsRs.columns);
  for (const item of items) {
    if (item.expense_id) {
      await db.execute({ sql: "UPDATE wish_list_items SET expense_id = NULL WHERE id = ?", args: [item.id] });
      await db.execute({ sql: "DELETE FROM expenses WHERE id = ?", args: [item.expense_id] });
    }
  }
  const del = await db.execute({ sql: "DELETE FROM wish_lists WHERE id = ?", args: [id] });
  return (del.rowsAffected ?? 0) > 0;
}

export async function getPendingWishListItems(): Promise<WishListItem[]> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "SELECT * FROM wish_list_items WHERE status = 'pending' ORDER BY target_date ASC, created_at ASC",
    args: [],
  });
  return rowsToObjs<WishListItem>(rs.rows as Row[], rs.columns);
}

export async function getPurchasedWishListItemsByDateRange(start: string, end: string): Promise<WishListItem[]> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: `SELECT * FROM wish_list_items
      WHERE status = 'purchased' AND purchased_at IS NOT NULL
      AND date(purchased_at) >= ? AND date(purchased_at) <= ?
      ORDER BY purchased_at ASC`,
    args: [start, end],
  });
  return rowsToObjs<WishListItem>(rs.rows as Row[], rs.columns);
}

export async function getWishListItems(listId: number): Promise<WishListItem[]> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "SELECT * FROM wish_list_items WHERE list_id = ? ORDER BY status ASC, target_date ASC, created_at ASC",
    args: [listId],
  });
  return rowsToObjs<WishListItem>(rs.rows as Row[], rs.columns);
}

export async function addWishListItem(item: Omit<WishListItem, "id" | "created_at">): Promise<WishListItem> {
  await ensureMigrations();
  const rs = await getDbClient().execute({
    sql: "INSERT INTO wish_list_items (list_id, name, target_date, estimated_amount, actual_amount, category, subcategory, notes, status, purchased_at, expense_id, shop_name, shop_phone, shop_address, shop_lat, shop_lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
    args: [
      item.list_id, item.name, item.target_date, item.estimated_amount, item.actual_amount ?? null,
      item.category || "misc", item.subcategory ?? null, item.notes || "", item.status || "pending",
      item.purchased_at ?? null, item.expense_id ?? null,
      item.shop_name ?? null, item.shop_phone ?? null, item.shop_address ?? null,
      item.shop_lat ?? null, item.shop_lng ?? null,
    ],
  });
  return rowToObj<WishListItem>(rs.rows[0] as Row, rs.columns);
}

export async function updateWishListItem(id: number, updates: Partial<Pick<WishListItem, "name" | "target_date" | "estimated_amount" | "actual_amount" | "category" | "subcategory" | "notes" | "shop_name" | "shop_phone" | "shop_address" | "shop_lat" | "shop_lng">>): Promise<WishListItem | null> {
  await ensureMigrations();
  const db = getDbClient();
  const currentRs = await db.execute({ sql: "SELECT * FROM wish_list_items WHERE id = ?", args: [id] });
  if (currentRs.rows.length === 0) return null;
  const current = rowToObj<WishListItem>(currentRs.rows[0] as Row, currentRs.columns);
  const merged = { ...current, ...updates };
  await db.execute({
    sql: "UPDATE wish_list_items SET name=?, target_date=?, estimated_amount=?, actual_amount=?, category=?, subcategory=?, notes=?, shop_name=?, shop_phone=?, shop_address=?, shop_lat=?, shop_lng=? WHERE id=?",
    args: [
      merged.name, merged.target_date, merged.estimated_amount, merged.actual_amount ?? null,
      merged.category || "misc", merged.subcategory ?? null, merged.notes || "",
      merged.shop_name ?? null, merged.shop_phone ?? null, merged.shop_address ?? null,
      merged.shop_lat ?? null, merged.shop_lng ?? null,
      id,
    ],
  });
  if (current.status === "purchased" && current.expense_id) {
    const amount = merged.actual_amount ?? merged.estimated_amount;
    await db.execute({
      sql: "UPDATE expenses SET description=?, category=?, amount=?, notes=? WHERE id=?",
      args: [merged.name, merged.category, amount, merged.notes ? `[Envie achetée] ${merged.notes}` : "[Envie achetée]", current.expense_id],
    });
  }
  const rs = await db.execute({ sql: "SELECT * FROM wish_list_items WHERE id = ?", args: [id] });
  return rowToObj<WishListItem>(rs.rows[0] as Row, rs.columns);
}

export async function markWishItemPurchased(id: number, actualAmount: number, userId: number, transactionFee = 0, accountId?: number | null): Promise<Expense | null> {
  await ensureMigrations();
  const db = getDbClient();
  const itemRs = await db.execute({ sql: "SELECT * FROM wish_list_items WHERE id = ? AND status = 'pending'", args: [id] });
  if (itemRs.rows.length === 0) return null;
  const item = rowToObj<WishListItem>(itemRs.rows[0] as Row, itemRs.columns);
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const purchasedAt = now.toISOString();
  const acc = accountId ?? (await getDefaultAccountId(userId));
  await assertAccountAllowsDebit(userId, acc);
  const ins = await db.execute({
    sql: "INSERT INTO expenses (user_id, date, time, description, category, amount, notes, payment_method, transaction_fee, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
    args: [userId, date, time, item.name, item.category, actualAmount, item.notes ? `[Envie achetée] ${item.notes}` : "[Envie achetée]", "cash", transactionFee, acc],
  });
  const expense = rowToObj<Expense>(ins.rows[0] as Row, ins.columns);
  await db.execute({
    sql: "UPDATE wish_list_items SET status = 'purchased', actual_amount = ?, purchased_at = ?, expense_id = ? WHERE id = ?",
    args: [actualAmount, purchasedAt, expense.id, id],
  });
  return expense;
}

export async function deleteWishListItem(id: number): Promise<boolean> {
  await ensureMigrations();
  const db = getDbClient();
  const itemRs = await db.execute({ sql: "SELECT * FROM wish_list_items WHERE id = ?", args: [id] });
  if (itemRs.rows.length === 0) return false;
  const item = rowToObj<WishListItem>(itemRs.rows[0] as Row, itemRs.columns);
  if (item.status === "purchased" && item.expense_id) {
    await db.execute({ sql: "UPDATE wish_list_items SET expense_id = NULL WHERE id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM expenses WHERE id = ?", args: [item.expense_id] });
  }
  const del = await db.execute({ sql: "DELETE FROM wish_list_items WHERE id = ?", args: [id] });
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
    accounts?: Account[];
    account_transfers?: AccountTransfer[];
    config: BudgetConfig;
    savings: Array<{ id?: number; month: number; year: number; amount: number }>;
    salaries: Array<{ id?: number; month: number; year: number; amount: number; account_id?: number | null }>;
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
  const [expensesRs, incomesRs, accountsRs, transfersRs, savingsRs, salariesRs, projectsRs, fcpRs, loansRs, loanPayRs, plannedRs] = await Promise.all([
    db.execute("SELECT * FROM expenses ORDER BY id"),
    db.execute("SELECT * FROM incomes ORDER BY id"),
    db.execute("SELECT * FROM accounts ORDER BY id"),
    db.execute("SELECT * FROM account_transfers ORDER BY id"),
    db.execute("SELECT * FROM savings ORDER BY year, month"),
    db.execute("SELECT * FROM salaries ORDER BY year, month"),
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
      accounts: rowsToObjs<Account>(accountsRs.rows as Row[], accountsRs.columns),
      account_transfers: rowsToObjs<AccountTransfer>(transfersRs.rows as Row[], transfersRs.columns),
      config,
      savings: rowsToObjs(savingsRs.rows as Row[], savingsRs.columns),
      salaries: rowsToObjs(salariesRs.rows as Row[], salariesRs.columns),
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
      { sql: "DELETE FROM account_transfers" },
      { sql: "DELETE FROM accounts" },
      { sql: "DELETE FROM savings" },
      { sql: "DELETE FROM salaries" },
      { sql: "DELETE FROM project_purchases" },
      { sql: "DELETE FROM project_funds" },
      { sql: "DELETE FROM projects" },
      { sql: "DELETE FROM config" },
    ];
    if (data.config) {
      batch.push({ sql: "INSERT INTO config (id, data) VALUES (1, ?)", args: [JSON.stringify(data.config)] });
    }
    for (const a of data.accounts || []) {
      batch.push({
        sql: `INSERT INTO accounts (id, user_id, name, kind, subtype, institution_name, notes, icon, color, logo_url, opening_balance, is_archived, sort_order, created_at, vault_unlocks_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          a.id,
          userId,
          a.name,
          a.kind,
          a.subtype ?? "",
          a.institution_name ?? "",
          a.notes || "",
          a.icon || "wallet",
          a.color || "#6366f1",
          a.logo_url ?? "",
          a.opening_balance ?? 0,
          a.is_archived ?? 0,
          a.sort_order ?? 0,
          a.created_at || new Date().toISOString(),
          a.vault_unlocks_on ?? null,
        ],
      });
    }
    for (const t of data.account_transfers || []) {
      batch.push({
        sql: `INSERT INTO account_transfers (id, user_id, from_account_id, to_account_id, amount, fee, fees_account_id, date, time, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        args: [
          t.id,
          userId,
          t.from_account_id,
          t.to_account_id,
          t.amount,
          t.fee ?? 0,
          (t as AccountTransfer).fees_account_id ?? null,
          t.date,
          t.time || "00:00",
          t.notes || "",
          t.created_at || new Date().toISOString(),
        ],
      });
    }
    for (const e of data.expenses || []) {
      batch.push({
        sql: "INSERT INTO expenses (id, user_id, date, time, description, category, amount, notes, payment_method, transaction_fee, account_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [e.id, userId, e.date, e.time || "00:00", e.description, e.category, e.amount, e.notes || "", (e as Expense).payment_method || "cash", (e as Expense).transaction_fee ?? 0, (e as Expense).account_id ?? null, e.created_at || new Date().toISOString()],
      });
    }
    for (const i of data.incomes || []) {
      batch.push({
        sql: "INSERT INTO incomes (id, date, time, description, source, amount, notes, account_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [i.id, i.date, i.time || "00:00", i.description, i.source || "other", i.amount, i.notes || "", (i as Income).account_id ?? null, i.created_at || new Date().toISOString()],
      });
    }
    for (const s of data.savings || []) {
      batch.push({ sql: "INSERT INTO savings (month, year, amount) VALUES (?, ?, ?)", args: [s.month, s.year, s.amount ?? 0] });
    }
    for (const s of data.salaries || []) {
      batch.push({
        sql: "INSERT INTO salaries (month, year, amount, account_id) VALUES (?, ?, ?, ?)",
        args: [s.month, s.year, s.amount ?? 0, (s as { account_id?: number | null }).account_id ?? null],
      });
    }
    for (const p of data.projects || []) {
      batch.push({
        sql: "INSERT INTO projects (id, name, description, target_amount, saved_amount, deadline, color, icon, status, created_at, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
          (p as Project).account_id ?? null,
        ],
      });
    }
    for (const l of data.loans || []) {
      batch.push({
        sql: "INSERT INTO loans (id, type, label, lender_borrower, total_amount, remaining_amount, interest_rate, fees, monthly_payment, start_date, end_date, next_due_date, notes, status, created_at, payment_account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
          (l as Loan).payment_account_id ?? null,
        ],
      });
    }
    for (const lp of data.loan_payments || []) {
      batch.push({
        sql: "INSERT INTO loan_payments (id, loan_id, amount, fees, date, time, notes, created_at, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          lp.id,
          lp.loan_id,
          lp.amount,
          lp.fees ?? 0,
          lp.date,
          lp.time || "00:00",
          lp.notes || "",
          lp.created_at || new Date().toISOString(),
          (lp as LoanPayment).account_id ?? 0,
        ],
      });
    }
    for (const f of data.fixed_charge_payments || []) {
      batch.push({
        sql: "INSERT INTO fixed_charge_payments (id, charge_id, label, icon, amount, date, time, month, year, notes, created_at, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          f.id,
          f.charge_id,
          f.label,
          f.icon || "house",
          f.amount,
          f.date,
          f.time || "00:00",
          f.month,
          f.year,
          f.notes || "",
          f.created_at || new Date().toISOString(),
          (f as FixedChargePayment).account_id ?? 0,
        ],
      });
    }
    for (const pe of data.planned_expenses || []) {
      batch.push({
        sql: "INSERT INTO planned_expenses (id, due_date, description, category, amount, notes, status, expense_id, created_at, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
          (pe as PlannedExpense).account_id ?? 0,
        ],
      });
    }
    await tx.batch(batch);
    await tx.commit();
    const db2 = getDbClient();
    await ensureUserDefaultAccount(userId);
    const defRs = await db2.execute({
      sql: "SELECT id FROM accounts WHERE user_id = ? ORDER BY sort_order ASC, id ASC LIMIT 1",
      args: [userId],
    });
    if (defRs.rows.length > 0) {
      const defId = Number((defRs.rows[0] as Row).id);
      await db2.execute({ sql: "UPDATE expenses SET account_id = ? WHERE user_id = ? AND account_id IS NULL", args: [defId, userId] });
      await db2.execute({ sql: "UPDATE incomes SET account_id = ? WHERE account_id IS NULL", args: [defId] });
    }
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
