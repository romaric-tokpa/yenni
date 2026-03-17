import { NextRequest, NextResponse } from "next/server";
import { getFixedChargePayments, getFixedChargePaymentsByDateRange, addFixedChargePayment, deleteFixedChargePayment, ensureRecurringPayments } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const start = sp.get("start");
    const end = sp.get("end");
    if (start && end) {
      return NextResponse.json(await getFixedChargePaymentsByDateRange(start, end));
    }
    const month = sp.get("month");
    const year = sp.get("year");
    if (month !== null && year !== null) {
      const m = parseInt(month);
      const y = parseInt(year);
      await ensureRecurringPayments(m, y);
      return NextResponse.json(await getFixedChargePayments(m, y));
    }
    return NextResponse.json(await getFixedChargePayments());
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { charge_id, label, icon, amount, date, time, month, year, notes } = body;
    if (!charge_id || !label || !amount || amount <= 0 || !date || month === undefined || !year) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }
    const payment = addFixedChargePayment({
      charge_id,
      label,
      icon: icon || "house",
      amount,
      date,
      time: time || "00:00",
      month,
      year,
      notes: notes || "",
    });
    return NextResponse.json(payment, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = parseInt(new URL(req.url).searchParams.get("id") || "0");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const ok = await deleteFixedChargePayment(id);
    if (!ok) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
