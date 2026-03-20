import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import {
  getAccountById,
  getAccounts,
  getAccountsWithBalances,
  getExpensesForAccount,
  getIncomesForAccount,
  getAccountTransfersInvolving,
} from "@/lib/db";
import { apiErrorResponse } from "@/lib/apiError";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const id = parseInt((await params).id, 10);
    if (isNaN(id)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const account = await getAccountById(id, session.userId);
    if (!account) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

    const [withBalances, accountsList, expenses, incomes, transfers] = await Promise.all([
      getAccountsWithBalances(session.userId),
      getAccounts(session.userId),
      getExpensesForAccount(session.userId, id),
      getIncomesForAccount(id),
      getAccountTransfersInvolving(session.userId, id),
    ]);

    const balanceRow = withBalances.find((a) => a.id === id);
    const accountNames: Record<string, string> = {};
    for (const a of accountsList) {
      accountNames[String(a.id)] = a.name;
    }

    return NextResponse.json({
      account,
      balance: balanceRow?.balance ?? account.opening_balance,
      accountNames,
      expenses,
      incomes,
      transfers,
    });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
