export type TransactionType = 'expense' | 'income' | 'transfer';
export type AccountType = 'cash' | 'bank' | 'upi' | 'credit_card' | 'wallet' | 'investment';
export type AssetType = 'bank' | 'cash' | 'stocks' | 'mutual_funds' | 'crypto' | 'gold' | 'real_estate' | 'other';
export type LiabilityType = 'credit_card' | 'loan' | 'mortgage' | 'other';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type CategoryType = 'expense' | 'income' | 'both';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  color: string;
  icon: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  isCustom: boolean;
  parentId?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  toAccountId?: string;
  merchant?: string;
  notes?: string;
  tags: string[];
  date: string;
  isRecurring: boolean;
  recurringId?: string;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  accountName?: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  limit_amount: number;
  spent: number;
  month: string;
  year: number;
  alertAt: number;
  createdAt: string;
  updatedAt: string;
  // Joined
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  icon: string;
  color: string;
  accountId?: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  value: number;
  notes?: string;
  lastUpdated: string;
  createdAt: string;
}

export interface Liability {
  id: string;
  name: string;
  type: LiabilityType;
  amount: number;
  interestRate: number;
  dueDate?: string;
  notes?: string;
  lastUpdated: string;
  createdAt: string;
}

export interface RecurringTemplate {
  id: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  merchant?: string;
  notes?: string;
  tags: string[];
  frequency: RecurringFrequency;
  startDate: string;
  nextDue: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NetWorthHistory {
  id: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  date: string;
}

export interface DashboardStats {
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  netWorth: number;
}

export interface TransactionFilters {
  search?: string;
  type?: TransactionType;
  categoryId?: string;
  accountId?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  tags?: string[];
}
