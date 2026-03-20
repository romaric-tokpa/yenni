export interface Expense {
  id: number;
  date: string;
  time: string;
  description: string;
  category: string;
  amount: number;
  notes: string;
  payment_method?: string;
  transaction_fee?: number;
  /** Compte débité (obligatoire en création via API) */
  account_id?: number | null;
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
  /** Compte crédité (obligatoire en création via API) */
  account_id?: number | null;
  created_at: string;
}

/** Compte de trésorerie (Mobile Money, banque, espèces, etc.) */
export interface Account {
  id: number;
  user_id: number;
  name: string;
  kind: string;
  /** Sous-type : ex. opérateur mobile money (`wave`, `orange_money`, …) */
  subtype?: string;
  /** Nom de la banque / établissement (`kind` bancaire) */
  institution_name?: string;
  notes: string;
  icon: string;
  color: string;
  /** Image opérateur (data URI), affichée à la place de l’icône si présente */
  logo_url?: string;
  opening_balance: number;
  is_archived: number;
  sort_order: number;
  created_at: string;
  /**
   * Coffre (kind `vault`) : date YYYY-MM-DD à partir de laquelle les sorties sont autorisées.
   * `null` = pas de verrou, ou débloqué manuellement.
   */
  vault_unlocks_on?: string | null;
}

export type AccountWithBalance = Account & { balance: number };

/** Transfert entre deux comptes */
export interface AccountTransfer {
  id: number;
  user_id: number;
  from_account_id: number;
  to_account_id: number;
  amount: number;
  fee: number;
  /** Si renseigné et différent de la source : les frais sont prélevés sur ce compte */
  fees_account_id?: number | null;
  date: string;
  time: string;
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

/** Sous-catégorie d'une catégorie d'envie */
export interface WishSubcategory {
  id: string;
  label: string;
}

/** Catégorie personnalisée pour les envies (liste des souhaits) */
export interface WishCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  subcategories?: WishSubcategory[];
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
  /** Compte débité pour ce paiement */
  account_id?: number;
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
  /** Compte sur lequel est versée l’épargne du projet */
  account_id?: number | null;
}

export interface ProjectPurchase {
  id: number;
  project_id: number;
  description: string;
  amount: number;
  date: string;
  expense_id: number | null;
  created_at: string;
  /** Compte débité (si pas de expense_id liée) */
  account_id?: number | null;
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
  /** Compte prélevé pour ce versement (transfert vers le compte du projet) */
  from_account_id?: number | null;
  /** Alias / piste comptable : même sens que from_account_id pour les versements */
  account_id?: number | null;
}

export interface BudgetConfig {
  salary: number;
  otherIncome: number;
  fixedCharges: FixedCharge[];
  categories: Category[];
  /** Catégories personnalisées pour la liste des envies */
  wishCategories?: WishCategory[];
  savingsGoal: number;
  /** Date de début de la période d'épargne (YYYY-MM-DD). Définit le cadre temporel. */
  savingsGoalStartDate?: string;
  /** Date cible pour le fonds d'urgence (YYYY-MM-DD). Fin de la période d'épargne. */
  savingsGoalDeadline?: string;
  /** Compte coffre (`kind === "vault"`) dont le solde suit l’objectif fonds d’urgence. */
  emergency_fund_account_id?: number | null;
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
  insurance_rate?: number;
  tax_rate?: number;
  fees_amount?: number;
  effective_rate?: number;
  bank_name?: string;
  agency?: string;
  loan_number?: string;
  first_payment_date?: string;
  payment_day?: number;
  total_payments?: number;
  paid_payments?: number;
  /** Prélèvements (banque / emprunt perso) ou encaissements par défaut (prêt fait) — référence `accounts.id` */
  payment_account_id?: number | null;
}

export interface LoanScheduleRow {
  id: number;
  user_id: number;
  loan_id: number;
  number: number;
  due_date: string;
  principal: number;
  interest: number;
  insurance: number;
  tax_interest: number;
  tax_insurance: number;
  fees: number;
  total_payment: number;
  remaining_balance: number;
  status: "paid" | "pending" | "overdue" | "upcoming";
  paid_at: string | null;
  payment_note: string;
  expense_id?: number | null;
  paid_amount?: number | null;
}

export type ScheduleRowUpdate = Partial<Pick<LoanScheduleRow, "due_date" | "principal" | "interest" | "insurance" | "tax_interest" | "tax_insurance" | "fees" | "total_payment" | "remaining_balance" | "paid_amount">>;

export interface LoanScheduleInput {
  number: number;
  due_date: string;
  principal: number;
  interest: number;
  insurance: number;
  tax_interest: number;
  tax_insurance: number;
  fees: number;
  total_payment: number;
  remaining_balance: number;
  status: "paid" | "pending";
  paid_at?: string | null;
  paid_amount?: number | null;
  expense_id?: number | null;
}

export interface LoanStats {
  totalBorrowed: number;
  totalCost: number;
  totalInterest: number;
  totalInsurance: number;
  totalTaxes: number;
  totalFees: number;
  totalRepaid: number;
  remainingBalance: number;
  paidCount: number;
  totalCount: number;
  progressPercent: number;
  monthlyPayment: number;
  nextDueDate: string | null;
  nextDueAmount: number;
  endDate: string;
  debtRatio: number;
  daysUntilNextDue: number;
  overdueCount: number;
}

export interface LoanFormData {
  type: "bank";
  label: string;
  bank_name: string;
  agency: string;
  loan_number: string;
  total_amount: number;
  interest_rate: number;
  insurance_rate: number;
  tax_rate: number;
  fees_amount: number;
  monthly_payment: number;
  total_payments: number;
  start_date: string;
  first_payment_date: string;
  payment_day: number;
  already_paid: number;
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
  expense_id?: number | null;
  income_id?: number | null;
  /** Compte impacté (redondant avec expense/income liés ; utilisé pour imports sans écriture liée) */
  account_id?: number | null;
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
  /** Compte à débiter à l’exécution (0 = défaut utilisateur) */
  account_id?: number | null;
}

/** @deprecated Utiliser WishList + WishListItem */
export interface Wish {
  id: number;
  name: string;
  target_date: string;
  estimated_amount: number;
  actual_amount: number | null;
  category: string;
  subcategory?: string | null;
  notes: string;
  status: "pending" | "purchased";
  expense_id: number | null;
  created_at: string;
}

/** Liste d'envies (ex: envies vêtements, envies électronique) */
export interface WishList {
  id: number;
  name: string;
  scheduled_date: string;
  created_at: string;
}

/** Article d'une liste d'envies */
export interface WishListItem {
  id: number;
  list_id: number;
  name: string;
  target_date: string;
  estimated_amount: number;
  actual_amount: number | null;
  category: string;
  subcategory?: string | null;
  notes: string;
  status: "pending" | "purchased";
  purchased_at: string | null;
  expense_id: number | null;
  shop_name: string | null;
  shop_phone: string | null;
  shop_address: string | null;
  shop_lat: number | null;
  shop_lng: number | null;
  created_at: string;
}

/** Liste de courses (ex: course nourriture, course maison) */
export interface ShoppingList {
  id: number;
  name: string;
  scheduled_date: string;
  created_at: string;
}

/** Article d'une liste de courses */
export interface ShoppingListItem {
  id: number;
  list_id: number;
  name: string;
  category: string;
  estimated_amount: number;
  actual_amount: number | null;
  status: "pending" | "purchased";
  purchased_at: string | null;
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

export type NotificationSourceType = "loan_due" | "loan_overdue" | "loan_upcoming" | "change_encash" | "planned_expense" | "wish" | "shopping" | "reminder";

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
  loan_id?: number;
  schedule_number?: number;
  action_label?: string;
  action_url?: string;
  priority?: "high" | "medium" | "low";
}
