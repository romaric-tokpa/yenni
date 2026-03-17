import { NextResponse } from "next/server";
import { getLoans, getPlannedExpenses } from "@/lib/db";
import type { NotificationTodo } from "@/lib/types";

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function daysBetween(dateStr: string): number {
  const today = new Date(getTodayStr());
  const d = new Date(dateStr);
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export async function GET() {
  try {
    const today = getTodayStr();
    const todos: NotificationTodo[] = [];

    // Prêts avec échéance à venir ou dépassée (dans les 7 prochains jours ou en retard)
    const loans = await getLoans();
    const activeLoans = loans.filter((l) => l.status === "active" && l.next_due_date);

    for (const loan of activeLoans) {
      const days = daysBetween(loan.next_due_date);
      if (days <= 7) {
        todos.push({
          id: `loan-${loan.id}`,
          type: "todo",
          source_type: "loan_due",
          source_id: loan.id,
          title: "Mensualité prêt",
          message: loan.label,
          amount: loan.monthly_payment,
          due_date: loan.next_due_date,
          link: `/loans?pay=${loan.id}`,
          is_overdue: days < 0,
          days_left: days,
        });
      }
    }

    // Toutes les dépenses planifiées en attente
    const planned = await getPlannedExpenses("pending");
    for (const p of planned) {
      const days = daysBetween(p.due_date);
      todos.push({
        id: `planned-${p.id}`,
        type: "todo",
        source_type: "planned_expense",
        source_id: p.id,
        title: "Dépense planifiée",
        message: p.description,
        amount: p.amount,
        due_date: p.due_date,
        link: `/expenses?planned=${p.id}`,
        is_overdue: days < 0,
        days_left: days,
      });
    }

    // Trier : en retard d'abord, puis par date d'échéance
    todos.sort((a, b) => {
      if (a.is_overdue && !b.is_overdue) return -1;
      if (!a.is_overdue && b.is_overdue) return 1;
      return a.due_date.localeCompare(b.due_date);
    });

    return NextResponse.json(todos);
  } catch (err) {
    console.error("[API ERROR]", req.method, req.url, err);
    return NextResponse.json({ error: "Erreur serveur", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
