import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type IoniconsName = ComponentProps<typeof Ionicons>['name'];

export type TransactionType = 'expense' | 'income' | 'transfer';
export type AccountType = 'cash' | 'bank' | 'upi' | 'credit_card' | 'wallet' | 'investment';
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
export type PaymentMethod = string;

export type SplitMethod = 'equal' | 'exact' | 'percent';
export type SplitStatus = 'pending' | 'paid' | 'dismissed';

export interface SyncMetadata {
  userId?: string | null;
  syncStatus: SyncStatus;
  lastSyncedAt?: string | null;
  deletedAt?: string | null;
  deviceId?: string | null;
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
  limitAmount: number;
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

export interface SplitExpense extends SyncMetadata {
  id: string;
  transactionId: string;
  paidByUserId: string;
  totalAmount: number;
  splitMethod: SplitMethod;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SplitMember extends SyncMetadata {
  id: string;
  splitExpenseId: string;
  friendId?: string;
  name: string;
  shareAmount: number;
  sharePercent?: number;
  status: SplitStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SplitFriend extends SyncMetadata {
  id: string;
  name: string;
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
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Note extends SyncMetadata {
  id: string;
  title: string;
  content: string;
  color: string;
  isPinned: boolean;
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

// ─── FAB Speed Dial ─────────────────────────────────────────────────────────

export interface FABAction {
  id: string;
  label: string;
  icon: IoniconsName;
  color: string;
  onPress: () => void;
}

export type FABContext = 'dashboard' | 'transactions' | 'budgets' | 'goals' | 'notes' | 'splits';

// ─── Bottom Sheet ───────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info';

// ─── Chart Data ─────────────────────────────────────────────────────────────

export interface ChartDataPoint {
  timestamp: number;
  value: number;
}

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  amount: number;
  percentage: number;
}

// ─── Spending Insight ───────────────────────────────────────────────────────

export interface SpendingInsight {
  id: string;
  type: 'warning' | 'tip' | 'achievement';
  icon: IoniconsName;
  title: string;
  description: string;
  color: string;
}
