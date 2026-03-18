import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { getCategoryBudgets, setCategoryBudget } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const month = parseInt(url.searchParams.get("month") ?? "-1", 10);
    const year = parseInt(url.searchParams.get("year") ?? String(new Date().getFullYear()), 10);
    if (month < 0 || month > 11 || !year) {
      return NextResponse.json({ error: "month (0-11) et year requis" }, { status: 400 });
    }
    return NextResponse.json(await getCategoryBudgets(month, year));
  } catch (err) {
    console.error("[API category-budgets]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { month, year, category_id, amount } = await req.json();
    if (month === undefined || month < 0 || month > 11 || !year || !category_id || amount === undefined) {
      return NextResponse.json({ error: "Données invalides (month, year, category_id, amount)" }, { status: 400 });
    }
    await setCategoryBudget(month, year, String(category_id), Math.max(0, Number(amount)));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API category-budgets]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
