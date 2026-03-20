import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getAccountTransfers, getAccountTransfersForMonth, addAccountTransfer, deleteAccountTransfer } from "@/lib/db";
import { apiErrorResponse } from "@/lib/apiError";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const sp = new URL(req.url).searchParams;
    const monthRaw = sp.get("month");
    const yearRaw = sp.get("year");
    if (monthRaw !== null && yearRaw !== null) {
      const month = parseInt(monthRaw, 10);
      const year = parseInt(yearRaw, 10);
      if (
        Number.isInteger(month) &&
        month >= 0 &&
        month <= 11 &&
        Number.isInteger(year) &&
        year >= 1970 &&
        year <= 2100
      ) {
        return NextResponse.json(await getAccountTransfersForMonth(session.userId, month, year));
      }
    }
    const limit = Math.min(200, Math.max(1, parseInt(sp.get("limit") || "50", 10)));
    return NextResponse.json(await getAccountTransfers(session.userId, limit));
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const body = await req.json();
    const from = Number(body.from_account_id);
    const to = Number(body.to_account_id);
    const amount = Math.round(Number(body.amount));
    if (!from || !to || amount <= 0) {
      return NextResponse.json({ error: "Comptes source/destination et montant valides requis" }, { status: 400 });
    }
    try {
      const feesAcc =
        body.fees_account_id != null && body.fees_account_id !== ""
          ? parseInt(String(body.fees_account_id), 10)
          : null;
      const t = await addAccountTransfer(session.userId, from, to, amount, {
        fee: body.fee != null ? Math.round(Number(body.fee)) : 0,
        fees_account_id:
          feesAcc != null && Number.isFinite(feesAcc) && feesAcc > 0 ? feesAcc : null,
        date: body.date,
        time: body.time,
        notes: body.notes ? String(body.notes) : "",
      });
      return NextResponse.json(t, { status: 201 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "TRANSFER_SAME_ACCOUNT")
        return NextResponse.json({ error: "Les deux comptes doivent être différents" }, { status: 400 });
      if (msg === "ACCOUNT_NOT_FOUND")
        return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
      if (msg === "ACCOUNT_VAULT_LOCKED") {
        return NextResponse.json(
          {
            error:
              "Le compte source est un coffre encore verrouillé : transfert impossible jusqu’à la date prévue ou après déblocage.",
          },
          { status: 403 },
        );
      }
      throw e;
    }
  } catch (err) {
    console.error("[API ERROR]", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ error: "Solde insuffisant pour ce transfert (montant + frais)" }, { status: 400 });
    }
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const id = parseInt(new URL(req.url).searchParams.get("id") || "0", 10);
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const ok = await deleteAccountTransfer(id, session.userId);
    return ok
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: "Non trouvé" }, { status: 404 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
