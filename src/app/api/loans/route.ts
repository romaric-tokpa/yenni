import { NextRequest, NextResponse } from "next/server";
import { getLoans, addLoan, updateLoan, deleteLoan } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const status = new URL(req.url).searchParams.get("status") || undefined;
    return NextResponse.json(await getLoans(status));
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
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
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
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
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = parseInt(new URL(req.url).searchParams.get("id") || "0");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const ok = await deleteLoan(id);
    if (!ok) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
