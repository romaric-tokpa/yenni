import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { getSessionFromCookies } from "@/lib/auth";
import {
  getProjectFunds,
  addProjectFundWithTransfer,
  updateProjectFund,
  deleteProjectFund,
} from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }
    const funds = await getProjectFunds(projectId);
    return NextResponse.json(funds);
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const { id } = await params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }
    const body = await req.json();
    const { amount, date, notes } = body;
    const fromAccountId =
      body.from_account_id != null ? Number(body.from_account_id) : NaN;
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Montant requis" }, { status: 400 });
    }
    if (!Number.isFinite(fromAccountId)) {
      return NextResponse.json(
        { error: "Compte source requis pour le versement" },
        { status: 400 },
      );
    }
    const fundDate = date || new Date().toISOString().split("T")[0];
    const amt = Number(amount);
    const fund = await addProjectFundWithTransfer(session.userId, {
      project_id: projectId,
      amount: amt,
      date: fundDate,
      notes: notes || "",
      from_account_id: fromAccountId,
    });
    return NextResponse.json(fund, { status: 201 });
  } catch (err) {
    console.error("[API ERROR]", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "PROJECT_NO_ACCOUNT") {
      return NextResponse.json(
        {
          error:
            "Ce projet n’a pas de compte d’épargne : modifie le projet pour en choisir un.",
        },
        { status: 400 },
      );
    }
    if (msg === "ACCOUNT_VAULT_LOCKED") {
      return NextResponse.json(
        { error: "Versement impossible depuis ce compte pour le moment. Choisis un autre compte." },
        { status: 400 },
      );
    }
    if (msg === "TRANSFER_SAME_ACCOUNT") {
      return NextResponse.json(
        { error: "Le compte source et le compte du projet doivent être différents." },
        { status: 400 },
      );
    }
    if (msg === "ACCOUNT_NOT_FOUND") {
      return NextResponse.json({ error: "Compte introuvable" }, { status: 400 });
    }
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const body = await req.json();
    const fundId = typeof body.id === "number" ? body.id : parseInt(body.id, 10);
    if (!fundId || isNaN(fundId)) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }
    try {
      const fund = await updateProjectFund(fundId, {
        amount: body.amount,
        date: body.date,
        notes: body.notes,
      });
      return fund
        ? NextResponse.json(fund)
        : NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "PROJECT_FUND_TRANSFER_LOCKED") {
        return NextResponse.json(
          {
            error:
              "Ce versement est lié à un transfert : supprime-le et recrée-le pour changer le montant ou la date.",
          },
          { status: 400 },
        );
      }
      throw e;
    }
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }
    try {
      const ok = await deleteProjectFund(parseInt(id, 10), session.userId);
      return ok
        ? NextResponse.json({ success: true })
        : NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "ACCOUNT_VAULT_LOCKED") {
        return NextResponse.json(
          { error: "Impossible d’annuler ce versement depuis le compte du projet pour le moment." },
          { status: 400 },
        );
      }
      throw e;
    }
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
