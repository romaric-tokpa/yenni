/**
 * Source de vérité des soldes : agrégation de toutes les opérations par compte.
 * Le champ accounts.opening_balance sert de solde initial ; tout le reste vient des mouvements.
 *
 * Exclus du double comptage :
 * - project_funds (mouvement via transfert ou revenu lié)
 * - loan_payments liés à une dépense / un revenu (même effet que expense/income)
 * - project_purchases avec expense_id (déjà dans expenses)
 * - savings mensuel : l’épargne coffre est reflétée par account_transfers
 */

import { getDbClient } from "./db/client";
import { accountHasActiveOutgoingLock } from "./constants";

type Row = Record<string, unknown>;

function num(row: Row | undefined, key: string): number {
  if (!row) return 0;
  const v = row[key];
  return v == null ? 0 : Number(v);
}

/**
 * @param throughDateInclusive — Si renseigné (YYYY-MM-DD), seules les écritures avec `date <=` cette valeur sont prises en compte (solde « à date »).
 */
export async function calculateAccountBalance(
  userId: number,
  accountId: number,
  throughDateInclusive?: string,
): Promise<number> {
  const db = getDbClient();
  const td = throughDateInclusive?.trim() || "";
  const dateClause = td ? " AND date <= ?" : "";
  const loanDateClause = td ? " AND lp.date <= ?" : "";

  const accRs = await db.execute({
    sql: "SELECT opening_balance FROM accounts WHERE id = ? AND user_id = ?",
    args: [accountId, userId],
  });
  if (accRs.rows.length === 0) return 0;
  const opening = num(accRs.rows[0] as Row, "opening_balance");

  const incomeRs = await db.execute({
    sql: `SELECT COALESCE(SUM(amount), 0) AS s FROM incomes WHERE account_id = ?${dateClause}`,
    args: td ? [accountId, td] : [accountId],
  });
  const incomeIn = num(incomeRs.rows[0] as Row, "s");

  const expRs = await db.execute({
    sql: `SELECT COALESCE(SUM(amount + COALESCE(transaction_fee, 0)), 0) AS s FROM expenses WHERE account_id = ? AND (user_id = ? OR user_id IS NULL)${dateClause}`,
    args: td ? [accountId, userId, td] : [accountId, userId],
  });
  const expenseOut = num(expRs.rows[0] as Row, "s");

  const xferFromRs = await db.execute({
    sql: `
      SELECT COALESCE(SUM(
        amount + CASE
          WHEN fees_account_id IS NULL OR fees_account_id = from_account_id THEN COALESCE(fee, 0)
          ELSE 0
        END
      ), 0) AS s
      FROM account_transfers
      WHERE user_id = ? AND from_account_id = ?${dateClause}
    `,
    args: td ? [userId, accountId, td] : [userId, accountId],
  });
  const xferFrom = num(xferFromRs.rows[0] as Row, "s");

  const xferToRs = await db.execute({
    sql: `SELECT COALESCE(SUM(amount), 0) AS s FROM account_transfers WHERE user_id = ? AND to_account_id = ?${dateClause}`,
    args: td ? [userId, accountId, td] : [userId, accountId],
  });
  const xferTo = num(xferToRs.rows[0] as Row, "s");

  const xferFeeOnlyRs = await db.execute({
    sql: `
      SELECT COALESCE(SUM(COALESCE(fee, 0)), 0) AS s
      FROM account_transfers
      WHERE user_id = ?
        AND fees_account_id = ?
        AND fees_account_id IS NOT NULL
        AND fees_account_id != from_account_id${dateClause}
    `,
    args: td ? [userId, accountId, td] : [userId, accountId],
  });
  const xferFeesOnly = num(xferFeeOnlyRs.rows[0] as Row, "s");

  const fcpRs = await db.execute({
    sql: `SELECT COALESCE(SUM(amount), 0) AS s FROM fixed_charge_payments WHERE account_id = ?${dateClause}`,
    args: td ? [accountId, td] : [accountId],
  });
  const fcpOut = num(fcpRs.rows[0] as Row, "s");

  const loanDebitRs = await db.execute({
    sql: `
      SELECT COALESCE(SUM(lp.amount + COALESCE(lp.fees, 0)), 0) AS s
      FROM loan_payments lp
      INNER JOIN loans l ON l.id = lp.loan_id
      WHERE lp.account_id = ?
        AND (lp.expense_id IS NULL OR lp.expense_id = 0)
        AND (lp.income_id IS NULL OR lp.income_id = 0)
        AND l.type IN ('bank', 'personal_borrowed')${loanDateClause}
    `,
    args: td ? [accountId, td] : [accountId],
  });
  const loanDebit = num(loanDebitRs.rows[0] as Row, "s");

  const loanCreditRs = await db.execute({
    sql: `
      SELECT COALESCE(SUM(lp.amount), 0) AS s
      FROM loan_payments lp
      INNER JOIN loans l ON l.id = lp.loan_id
      WHERE lp.account_id = ?
        AND (lp.expense_id IS NULL OR lp.expense_id = 0)
        AND (lp.income_id IS NULL OR lp.income_id = 0)
        AND l.type = 'personal_lent'${loanDateClause}
    `,
    args: td ? [accountId, td] : [accountId],
  });
  const loanCredit = num(loanCreditRs.rows[0] as Row, "s");

  const ppRs = await db.execute({
    sql: `
      SELECT COALESCE(SUM(amount), 0) AS s FROM project_purchases
      WHERE account_id = ? AND (expense_id IS NULL OR expense_id = 0)${dateClause}
    `,
    args: td ? [accountId, td] : [accountId],
  });
  const projectPurchaseOut = num(ppRs.rows[0] as Row, "s");

  return (
    opening +
    incomeIn -
    expenseOut -
    xferFrom +
    xferTo -
    xferFeesOnly -
    fcpOut -
    loanDebit +
    loanCredit -
    projectPurchaseOut
  );
}

export async function recalculateAllBalances(
  userId: number,
): Promise<{ accountId: number; balance: number }[]> {
  const db = getDbClient();
  const rs = await db.execute({
    sql: "SELECT id FROM accounts WHERE user_id = ? ORDER BY sort_order ASC, id ASC",
    args: [userId],
  });
  const out: { accountId: number; balance: number }[] = [];
  for (const row of rs.rows) {
    const id = Number((row as Row).id);
    const balance = await calculateAccountBalance(userId, id);
    out.push({ accountId: id, balance });
  }
  return out;
}

export async function checkSufficientBalance(
  userId: number,
  accountId: number,
  amount: number,
): Promise<{ ok: boolean; balance: number; shortfall?: number }> {
  const balance = await calculateAccountBalance(userId, accountId);
  if (amount <= 0) return { ok: true, balance };
  if (balance >= amount) return { ok: true, balance };
  return { ok: false, balance, shortfall: amount - balance };
}

export async function checkVaultRules(
  userId: number,
  accountId: number,
): Promise<{ allowed: boolean; reason?: string; unlock_date?: string }> {
  const db = getDbClient();
  const rs = await db.execute({
    sql: "SELECT kind, vault_unlocks_on FROM accounts WHERE id = ? AND user_id = ?",
    args: [accountId, userId],
  });
  if (rs.rows.length === 0) return { allowed: false, reason: "ACCOUNT_NOT_FOUND" };
  const row = rs.rows[0] as Row;
  const kind = String(row.kind ?? "");
  if (!accountHasActiveOutgoingLock(kind, row.vault_unlocks_on as string | null | undefined)) {
    return { allowed: true };
  }
  const unlock = row.vault_unlocks_on as string | null | undefined;
  return {
    allowed: false,
    reason: "VAULT_LOCKED",
    unlock_date: typeof unlock === "string" ? unlock : undefined,
  };
}
