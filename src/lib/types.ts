export interface Expense {
  id: number;
  date: string;
  time: string;
  description: string;
  category: string;
  amount: number;
  notes: string;
  created_at: string;
}

export interface Income {
  id: number;
  date: string;
  time: string;
  description: string;
  source: string;
  amount: number;
  notes: string;
  created_at: string;
}

export interface Category {
  id: string;
  label: string;
  icon: string;
  budget: number;
  color: string;
}

export interface FixedCharge {
  id: string;
  label: string;
  icon: string;
  amount: number;
}

export interface FixedChargePayment {
  id: number;
  charge_id: string;
  label: string;
  icon: string;
  amount: number;
  date: string;
  time: string;
  month: number;
  year: number;
  notes: string;
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  target_amount: number;
  saved_amount: number;
  deadline: string;
  color: string;
  icon: string;
  status: "active" | "completed" | "paused";
  created_at: string;
}

export interface ProjectPurchase {
  id: number;
  project_id: number;
  description: string;
  amount: number;
  date: string;
  expense_id: number | null;
  created_at: string;
}

export interface ProjectFund {
  id: number;
  project_id: number;
  amount: number;
  date: string;
  notes: string;
  created_at: string;
  /** ID du revenu créé (fonds = revenu + épargne projet) */
  income_id?: number | null;
}

export interface BudgetConfig {
  salary: number;
  otherIncome: number;
  fixedCharges: FixedCharge[];
  categories: Category[];
  savingsGoal: number;
  /** Date cible pour le fonds d'urgence (YYYY-MM-DD). Si défini, permet le calcul de l'épargne mensuelle suggérée. */
  savingsGoalDeadline?: string;
}

export interface MonthlySaving {
  month: number;
  year: number;
  amount: number;
}

export interface MonthlyStats {
  totalIncome: number;
  totalFixed: number;
  totalVariable: number;
  totalSaved: number;
  resteAVivre: number;
  dailyBudget: number;
  savingsRate: number;
  debtRatio: number;
  categorySpending: Record<string, number>;
}

export interface Loan {
  id: number;
  type: "bank" | "personal_borrowed" | "personal_lent";
  label: string;
  lender_borrower: string;
  total_amount: number;
  remaining_amount: number;
  interest_rate: number;
  fees: number;
  monthly_payment: number;
  start_date: string;
  end_date: string;
  next_due_date: string;
  notes: string;
  status: "active" | "completed" | "defaulted";
  created_at: string;
}

export interface LoanPayment {
  id: number;
  loan_id: number;
  amount: number;
  fees: number;
  date: string;
  time: string;
  notes: string;
  created_at: string;
}

export interface PlannedExpense {
  id: number;
  due_date: string;
  description: string;
  category: string;
  amount: number;
  notes: string;
  status: "pending" | "executed" | "cancelled";
  expense_id: number | null;
  created_at: string;
}

export interface CalendarEvent {
  id: number;
  type: "expense" | "income" | "fixed" | "loan";
  date: string;
  time: string;
  description: string;
  amount: number;
  category?: string;
  source?: string;
  icon?: string;
}

export type NotificationSourceType = "loan_due" | "planned_expense" | "reminder";

export interface NotificationTodo {
  id: string;
  type: "todo";
  source_type: NotificationSourceType;
  source_id: number;
  title: string;
  message: string;
  amount?: number;
  due_date: string;
  link: string;
  is_overdue: boolean;
  days_left: number;
}
