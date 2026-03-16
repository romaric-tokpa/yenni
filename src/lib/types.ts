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

export interface BudgetConfig {
  salary: number;
  otherIncome: number;
  fixedCharges: FixedCharge[];
  categories: Category[];
  savingsGoal: number;
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
