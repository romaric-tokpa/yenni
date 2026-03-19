import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { getSessionFromCookies } from "@/lib/auth";
import { getLoans, getPlannedExpenses, getPendingWishListItems, getPendingShoppingListItems, getOverdueSchedules, getSchedulesForPeriod, refreshScheduleStatuses } from "@/lib/db";
import type { NotificationTodo } from "@/lib/types";

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function getEndOfMonthStr(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return d.toISOString().split("T")[0];
}

function isInCurrentMonth(dateStr: string): boolean {
  const today = getTodayStr();
  const endOfMonth = getEndOfMonthStr();
  return dateStr >= today && dateStr <= endOfMonth;
}

function daysBetween(dateStr: string): number {
  const today = new Date(getTodayStr());
  const d = new Date(dateStr);
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCFA(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

export async function GET() {
  try {
    const today = getTodayStr();
    const todos: NotificationTodo[] = [];
    const session = await getSessionFromCookies();

    // Échéances planifiées (loan_schedule) — nécessite auth
    if (session) {
      await refreshScheduleStatuses(session.userId);

      const overdue = await getOverdueSchedules(session.userId);
      overdue.forEach((s) => {
        todos.push({
          id: `loan-overdue-${s.loan_id}-${s.number}`,
          type: "todo",
          source_type: "loan_overdue",
          source_id: s.loan_id,
          title: `Échéance en retard — ${s.loan_label}`,
          message: `Échéance n°${s.number} du ${formatDate(s.due_date)} — ${formatCFA(s.total_payment)} FCFA`,
          amount: s.total_payment,
          due_date: s.due_date,
          link: `/loans?pay=${s.loan_id}&number=${s.number}`,
          is_overdue: true,
          days_left: daysBetween(s.due_date),
          priority: "high",
          action_label: "Payer",
          action_url: `/loans?pay=${s.loan_id}&number=${s.number}`,
          loan_id: s.loan_id,
          schedule_number: s.number,
        });
      });

      const endOfMonth = getEndOfMonthStr();
      const upcoming = await getSchedulesForPeriod(session.userId, today, endOfMonth);
      upcoming.forEach((s) => {
        const days = daysBetween(s.due_date);
        todos.push({
          id: `loan-upcoming-${s.loan_id}-${s.number}`,
          type: "todo",
          source_type: "loan_upcoming",
          source_id: s.loan_id,
          title: `Échéance dans ${days} jour(s) — ${s.loan_label}`,
          message: `Échéance n°${s.number} le ${formatDate(s.due_date)} — ${formatCFA(s.total_payment)} FCFA`,
          amount: s.total_payment,
          due_date: s.due_date,
          link: `/loans?view=${s.loan_id}`,
          is_overdue: false,
          days_left: days,
          priority: "medium",
          action_label: "Voir",
          action_url: `/loans?view=${s.loan_id}`,
          loan_id: s.loan_id,
          schedule_number: s.number,
        });
      });
    }

    // Prêts sans tableau d'amortissement (legacy) — échéance à venir ou dépassée
    const loans = await getLoans();
    const activeLoans = loans.filter((l) => l.status === "active" && l.next_due_date);
    const scheduleLoanIds = new Set(todos.filter((t) => t.loan_id).map((t) => t.loan_id));

    for (const loan of activeLoans) {
      if (scheduleLoanIds.has(loan.id)) continue;
      const days = daysBetween(loan.next_due_date);
      if (days > 0 && !isInCurrentMonth(loan.next_due_date)) continue;
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
        priority: days < 0 ? "high" : days <= 3 ? "medium" : "low",
      });
    }

    // Liste des envies (échéance à venir ou dépassée)
    const wishItems = await getPendingWishListItems();
    for (const w of wishItems) {
      const days = daysBetween(w.target_date);
      todos.push({
        id: `wish-${w.id}`,
        type: "todo",
        source_type: "wish",
        source_id: w.id,
        title: "Envie à acheter",
        message: w.name,
        amount: w.estimated_amount,
        due_date: w.target_date,
        link: `/wishes?highlight=${w.id}`,
        is_overdue: days < 0,
        days_left: days,
        priority: days < 0 ? "high" : days <= 3 ? "medium" : "low",
      });
    }

    // Listes de courses (articles en attente, date = scheduled_date de la liste)
    const shoppingItems = await getPendingShoppingListItems();
    for (const s of shoppingItems) {
      const dueDate = s.scheduled_date;
      const days = daysBetween(dueDate);
      todos.push({
        id: `shopping-${s.id}`,
        type: "todo",
        source_type: "shopping",
        source_id: s.id,
        title: "Liste de courses",
        message: s.name,
        amount: s.estimated_amount,
        due_date: dueDate,
        link: `/shopping-lists`,
        is_overdue: days < 0,
        days_left: days,
        priority: days < 0 ? "high" : days <= 3 ? "medium" : "low",
      });
    }

    // Trier par priorité : en retard d'abord, puis par date d'échéance, puis par priorité (high > medium > low)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    todos.sort((a, b) => {
      if (a.is_overdue && !b.is_overdue) return -1;
      if (!a.is_overdue && b.is_overdue) return 1;
      const dateCmp = a.due_date.localeCompare(b.due_date);
      if (dateCmp !== 0) return dateCmp;
      const aP = a.priority ? (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2) : 2;
      const bP = b.priority ? (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2) : 2;
      return aP - bP;
    });

    return NextResponse.json(todos);
  } catch (err) {
    console.error("[API ERROR] GET /api/notifications", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
