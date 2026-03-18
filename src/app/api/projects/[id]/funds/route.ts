import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import {
  getProjectFunds,
  addProjectFund,
  updateProjectFund,
  deleteProjectFund,
} from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }
    const body = await req.json();
    const { amount, date, notes } = body;
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Montant requis" }, { status: 400 });
    }
    const fundDate = date || new Date().toISOString().split("T")[0];
    const amt = Number(amount);
    const fund = await addProjectFund({
      project_id: projectId,
      amount: amt,
      date: fundDate,
      notes: notes || "",
      income_id: null,
    });
    return NextResponse.json(fund, { status: 201 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json();
    const fundId = typeof body.id === "number" ? body.id : parseInt(body.id, 10);
    if (!fundId || isNaN(fundId)) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }
    const fund = await updateProjectFund(fundId, {
      amount: body.amount,
      date: body.date,
      notes: body.notes,
    });
    return fund
      ? NextResponse.json(fund)
      : NextResponse.json({ error: "Non trouvé" }, { status: 404 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }
    const ok = await deleteProjectFund(parseInt(id, 10));
    return ok
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: "Non trouvé" }, { status: 404 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
