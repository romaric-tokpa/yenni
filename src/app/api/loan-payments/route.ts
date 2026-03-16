import { NextRequest, NextResponse } from "next/server";
import { getLoanPayments, getLoanPaymentsByDateRange, addLoanPayment, addLoanPaymentsBatch, deleteLoanPayment } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const start = sp.get("start");
    const end = sp.get("end");
    if (start && end) return NextResponse.json(getLoanPaymentsByDateRange(start, end));
    const loanId = sp.get("loan_id");
    const month = sp.get("month");
    const year = sp.get("year");
    if (loanId) return NextResponse.json(getLoanPayments(parseInt(loanId)));
    if (month !== null && year !== null) return NextResponse.json(getLoanPayments(undefined, parseInt(month), parseInt(year)));
    return NextResponse.json(getLoanPayments());
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.batch && Array.isArray(body.payments) && body.loan_id) {
      const count = addLoanPaymentsBatch(body.loan_id, body.payments);
      return NextResponse.json({ count }, { status: 201 });
    }
    if (!body.loan_id || !body.amount || body.amount <= 0 || !body.date) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }
    const payment = addLoanPayment(body);
    return NextResponse.json(payment, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = parseInt(new URL(req.url).searchParams.get("id") || "0");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const ok = deleteLoanPayment(id);
    if (!ok) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
