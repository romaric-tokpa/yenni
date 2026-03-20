import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getAccountsWithBalances, addAccount } from "@/lib/db";
import { apiErrorResponse } from "@/lib/apiError";
import { accountKindAllowsLogo } from "@/lib/accountLogoShared";
import { resolveAccountLogoInput } from "@/lib/accountLogoParse";
import { computeVaultUnlockDateFromNow } from "@/lib/constants";
import { isValidIsoDate } from "@/lib/dashboardTreasuryPeriod";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const throughRaw = req.nextUrl.searchParams.get("through");
    const through =
      throughRaw != null && String(throughRaw).trim() !== ""
        ? String(throughRaw).trim()
        : null;
    if (through != null && !isValidIsoDate(through)) {
      return NextResponse.json(
        { error: "Paramètre through invalide (attendu AAAA-MM-JJ)" },
        { status: 400 },
      );
    }
    return NextResponse.json(await getAccountsWithBalances(session.userId, through));
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
    if (!body.name?.trim() || !body.kind) {
      return NextResponse.json({ error: "Nom et type de compte requis" }, { status: 400 });
    }
    const kind = String(body.kind);
    const logoParsed = await resolveAccountLogoInput(body.logo_url);
    if (!logoParsed.ok) {
      return NextResponse.json({ error: logoParsed.error }, { status: 400 });
    }
    const logo_url = accountKindAllowsLogo(kind) ? logoParsed.dataUri : "";

    const institution_name =
      kind.startsWith("bank_") && body.institution_name != null
        ? String(body.institution_name).trim()
        : "";

    let vaultUnlocksOn: string | null = null;
    if (kind === "vault") {
      const monthsRaw =
        body.vault_lock_months != null ? Number(body.vault_lock_months) : NaN;
      if (!Number.isFinite(monthsRaw) || monthsRaw < 1) {
        return NextResponse.json(
          { error: "Indique une durée de blocage en mois (≥ 1) pour le coffre" },
          { status: 400 },
        );
      }
      vaultUnlocksOn = computeVaultUnlockDateFromNow(monthsRaw);
    } else if (kind === "bank_blocked_savings") {
      if (body.vault_lock_months != null && body.vault_lock_months !== "") {
        const monthsRaw = Number(body.vault_lock_months);
        if (Number.isFinite(monthsRaw) && monthsRaw >= 1) {
          vaultUnlocksOn = computeVaultUnlockDateFromNow(monthsRaw);
        }
      }
    }

    const acc = await addAccount(session.userId, {
      name: String(body.name).trim(),
      kind,
      subtype: body.subtype != null && body.subtype !== "" ? String(body.subtype).trim() : "",
      institution_name,
      notes: body.notes ? String(body.notes) : "",
      icon: body.icon ? String(body.icon) : "wallet",
      color: body.color ? String(body.color) : "#6366f1",
      logo_url,
      opening_balance: body.opening_balance != null ? Math.round(Number(body.opening_balance)) : 0,
      vault_unlocks_on: vaultUnlocksOn,
    });
    return NextResponse.json(acc, { status: 201 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
