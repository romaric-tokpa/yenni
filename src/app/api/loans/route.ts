import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { getLoans, getLoan, addLoan, updateLoan, deleteLoan } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    if (idParam) {
      const id = parseInt(idParam, 10);
      if (!isNaN(id)) {
        const loan = await getLoan(id);
        return loan ? NextResponse.json(loan) : NextResponse.json({ error: "Non trouvé" }, { status: 404 });
      }
    }
    const status = searchParams.get("status") || undefined;
    return NextResponse.json(await getLoans(status));
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.label || !body.total_amount || body.total_amount <= 0 || !body.start_date || !body.type) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }
    if (!body.remaining_amount) body.remaining_amount = body.total_amount;
    const loan = await addLoan(body);
    return NextResponse.json(loan, { status: 201 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const loan = await updateLoan(id, updates);
    if (!loan) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    return NextResponse.json(loan);
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = parseInt(new URL(req.url).searchParams.get("id") || "0");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const ok = await deleteLoan(id);
    if (!ok) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
