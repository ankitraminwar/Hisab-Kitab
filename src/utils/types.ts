export type TransactionType = 'expense' | 'income' | 'transfer';
export type AccountType =
  | 'cash'
  | 'bank'
  | 'upi'
  | 'credit_card'
  | 'wallet'
  | 'investment';
export type AssetType =
  | 'bank'
  | 'cash'
  | 'stocks'
  | 'mutual_funds'
  | 'crypto'
  | 'gold'
  | 'real_estate'
  | 'other';
export type LiabilityType = 'credit_card' | 'loan' | 'mortgage' | 'other';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type CategoryType = 'expense' | 'income' | 'both';
export type SyncStatus = 'synced' | 'pending' | 'failed';
export type ThemePreference = 'dark' | 'light' | 'system';
export type PaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'upi'
  | 'wallet'
  | 'credit_card'
  | 'debit_card'
  | 'other';

export interface SyncMetadata {
  userId?: string | null;
  syncStatus: SyncStatus;
  lastSyncedAt?: string | null;
  deletedAt?: string | null;
}

export interface Account extends SyncMetadata {
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

export interface Category extends SyncMetadata {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  isCustom: boolean;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction extends SyncMetadata {
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
  paymentMethod: PaymentMethod;
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

export interface Budget extends SyncMetadata {
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

export interface Goal extends SyncMetadata {
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

export interface Asset extends SyncMetadata {
  id: string;
  name: string;
  type: AssetType;
  value: number;
  notes?: string;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
}

export interface Liability extends SyncMetadata {
  id: string;
  name: string;
  type: LiabilityType;
  amount: number;
  interestRate: number;
  dueDate?: string;
  notes?: string;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTemplate extends SyncMetadata {
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

export interface NetWorthHistory extends SyncMetadata {
  id: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile extends SyncMetadata {
  id: string;
  name: string;
  email: string;
  phone?: string;
  currency: string;
  monthlyBudget: number;
  themePreference: ThemePreference;
  notificationsEnabled: boolean;
  biometricEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferences {
  enabled: boolean;
  dailyReminder: boolean;
  budgetAlerts: boolean;
  monthlyReportReminder: boolean;
}

export interface AuthCredentials {
  email: string;
  password: string;
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
  toAccountId?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  tags?: string[];
}

export interface PaginatedResult<T> {
  data: T[];
  hasMore: boolean;
  nextOffset: number;
}

export interface SyncQueueItem {
  id: string;
  entity: string;
  recordId: string;
  operation: 'upsert' | 'delete';
  payload: string;
  retryCount: number;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}
