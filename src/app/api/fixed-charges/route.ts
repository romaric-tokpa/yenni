import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { getSessionFromCookies } from "@/lib/auth";
import { getFixedChargePayments, getFixedChargePaymentsByDateRange, addFixedChargePayment, deleteFixedChargePayment, ensureRecurringPayments } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
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
      if (session) await ensureRecurringPayments(session.userId, m, y);
      return NextResponse.json(await getFixedChargePayments(m, y));
    }
    return NextResponse.json(await getFixedChargePayments());
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
    const { charge_id, label, icon, amount, date, time, month, year, notes, account_id } = body;
    if (!charge_id || !label || !amount || amount <= 0 || !date || month === undefined || !year) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }
    const acc = account_id != null ? parseInt(String(account_id), 10) : NaN;
    if (!Number.isFinite(acc) || acc <= 0) {
      return NextResponse.json({ error: "Compte requis (account_id)" }, { status: 400 });
    }
    const payment = await addFixedChargePayment(
      {
        charge_id,
        label,
        icon: icon || "house",
        amount,
        date,
        time: time || "00:00",
        month,
        year,
        notes: notes || "",
        account_id: acc,
      },
      session.userId,
    );
    return NextResponse.json(payment, { status: 201 });
  } catch (err) {
    console.error("[API ERROR]", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ error: "Solde insuffisant sur ce compte" }, { status: 400 });
    }
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = parseInt(new URL(req.url).searchParams.get("id") || "0");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const ok = await deleteFixedChargePayment(id);
    if (!ok) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
