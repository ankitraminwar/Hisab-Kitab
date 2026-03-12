import { create } from 'zustand';

import type {
  Account,
  Asset,
  Budget,
  Category,
  DashboardStats,
  Goal,
  Liability,
  NotificationPreferences,
  ThemePreference,
  Transaction,
  UserProfile,
} from '@/utils/types';

interface SyncStateUpdate {
  syncInProgress?: boolean;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
}

interface AppState {
  isLocked: boolean;
  biometricsEnabled: boolean;
  biometricsPrompted: boolean;
  pinEnabled: boolean;
  isOnline: boolean;
  syncInProgress: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  accounts: Account[];
  categories: Category[];
  recentTransactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  assets: Asset[];
  liabilities: Liability[];
  dashboardStats: DashboardStats;
  isLoading: boolean;
  theme: ThemePreference;
  userProfile: UserProfile | null;
  notificationPreferences: NotificationPreferences;
  selectedMonth: string;
  dataRevision: number;
  setLocked: (locked: boolean) => void;
  setBiometrics: (enabled: boolean) => void;
  setBiometricsPrompted: (prompted: boolean) => void;
  setOnline: (online: boolean) => void;
  setSyncState: (state: SyncStateUpdate) => void;
  setAccounts: (accounts: Account[]) => void;
  setCategories: (categories: Category[]) => void;
  setRecentTransactions: (transactions: Transaction[]) => void;
  setBudgets: (budgets: Budget[]) => void;
  setGoals: (goals: Goal[]) => void;
  setAssets: (assets: Asset[]) => void;
  setLiabilities: (liabilities: Liability[]) => void;
  setDashboardStats: (stats: DashboardStats) => void;
  setLoading: (loading: boolean) => void;
  setTheme: (theme: ThemePreference) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setNotificationPreferences: (preferences: NotificationPreferences) => void;
  setSelectedMonth: (month: string) => void;
  bumpDataRevision: () => void;
  resetAppState: () => void;
}

const initialState: Pick<
  AppState,
  | 'isLocked'
  | 'biometricsEnabled'
  | 'biometricsPrompted'
  | 'pinEnabled'
  | 'isOnline'
  | 'syncInProgress'
  | 'lastSyncAt'
  | 'lastSyncError'
  | 'accounts'
  | 'categories'
  | 'recentTransactions'
  | 'budgets'
  | 'goals'
  | 'assets'
  | 'liabilities'
  | 'dashboardStats'
  | 'isLoading'
  | 'theme'
  | 'userProfile'
  | 'notificationPreferences'
  | 'selectedMonth'
  | 'dataRevision'
> = {
  isLocked: true,
  biometricsEnabled: false,
  biometricsPrompted: false,
  pinEnabled: false,
  isOnline: true,
  syncInProgress: false,
  lastSyncAt: null,
  lastSyncError: null,
  accounts: [],
  categories: [],
  recentTransactions: [],
  budgets: [],
  goals: [],
  assets: [],
  liabilities: [],
  dashboardStats: {
    totalBalance: 0,
    totalIncome: 0,
    totalExpenses: 0,
    savingsRate: 0,
    netWorth: 0,
  },
  isLoading: false,
  theme: 'dark',
  userProfile: null,
  notificationPreferences: {
    enabled: false,
    dailyReminder: false,
    budgetAlerts: true,
    monthlyReportReminder: true,
  },
  selectedMonth: new Date().toISOString().slice(0, 7),
  dataRevision: 0,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,
  setLocked: (locked) => set({ isLocked: locked }),
  setBiometrics: (enabled) => set({ biometricsEnabled: enabled }),
  setBiometricsPrompted: (prompted) => set({ biometricsPrompted: prompted }),
  setOnline: (isOnline) => set({ isOnline }),
  setSyncState: (syncState) => set(syncState),
  setAccounts: (accounts) => set({ accounts }),
  setCategories: (categories) => set({ categories }),
  setRecentTransactions: (recentTransactions) => set({ recentTransactions }),
  setBudgets: (budgets) => set({ budgets }),
  setGoals: (goals) => set({ goals }),
  setAssets: (assets) => set({ assets }),
  setLiabilities: (liabilities) => set({ liabilities }),
  setDashboardStats: (dashboardStats) => set({ dashboardStats }),
  setLoading: (isLoading) => set({ isLoading }),
  setTheme: (theme) => set({ theme }),
  setUserProfile: (userProfile) => set({ userProfile }),
  setNotificationPreferences: (notificationPreferences) =>
    set({ notificationPreferences }),
  setSelectedMonth: (selectedMonth) => set({ selectedMonth }),
  bumpDataRevision: () =>
    set((state) => ({ dataRevision: state.dataRevision + 1 })),
  resetAppState: () => set({ ...initialState }),
}));
