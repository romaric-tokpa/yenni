import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { getSessionFromCookies } from "@/lib/auth";
import {
  getSavings,
  setSavingAndSyncEmergencyVault,
  getTotalSavingsCumulative,
  getSavingsInPeriod,
} from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get("cumulative") === "true") {
      return NextResponse.json(await getTotalSavingsCumulative());
    }
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    if (startDate && endDate) {
      return NextResponse.json(await getSavingsInPeriod(startDate, endDate));
    }
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear())
    );
    return NextResponse.json(await getSavings(year));
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const body = await req.json();
    const month = Number(body.month);
    const year = Number(body.year);
    const amount =
      body.amount == null || body.amount === "" ? 0 : Number(body.amount);
    if (
      !Number.isFinite(month) ||
      !Number.isInteger(month) ||
      month < 0 ||
      month > 11 ||
      !Number.isFinite(year) ||
      year < 1970 ||
      year > 2100 ||
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }
    await setSavingAndSyncEmergencyVault(session.userId, month, year, amount);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API ERROR]", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "ACCOUNT_VAULT_LOCKED") {
      return NextResponse.json(
        { error: "Impossible d’ajuster l’épargne sur ce compte pour le moment." },
        { status: 400 },
      );
    }
    if (msg === "NO_DEBIT_ACCOUNT_FOR_SAVINGS") {
      return NextResponse.json(
        {
          error:
            "Aucun compte disponible pour prélever l’épargne : ajoute ou réactive un compte source dans Trésorerie.",
        },
        { status: 400 },
      );
    }
    if (msg === "NO_ACCOUNT_FOR_SAVINGS_RETURN") {
      return NextResponse.json(
        { error: "Il faut au moins un autre compte que le coffre pour enregistrer un retrait d’épargne." },
        { status: 400 },
      );
    }
    if (msg === "TRANSFER_SAME_ACCOUNT") {
      return NextResponse.json({ error: "Transfert impossible entre le même compte." }, { status: 400 });
    }
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
