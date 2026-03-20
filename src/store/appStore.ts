import { create, type StateCreator } from 'zustand';

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
} from '../utils/types';

// ─── Slice Interfaces ────────────────────────────────────────────────────────

interface SyncStateUpdate {
  syncInProgress?: boolean;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
}

interface AuthSlice {
  isLocked: boolean;
  biometricsEnabled: boolean;
  biometricsPrompted: boolean;
  pinEnabled: boolean;
  userProfile: UserProfile | null;
  setLocked: (locked: boolean) => void;
  setBiometrics: (enabled: boolean) => void;
  setBiometricsPrompted: (prompted: boolean) => void;
  setUserProfile: (profile: UserProfile | null) => void;
}

interface UISlice {
  isLoading: boolean;
  theme: ThemePreference;
  notificationPreferences: NotificationPreferences;
  selectedMonth: string;
  setLoading: (loading: boolean) => void;
  setTheme: (theme: ThemePreference) => void;
  setNotificationPreferences: (preferences: NotificationPreferences) => void;
  setSelectedMonth: (month: string) => void;
}

interface DataSlice {
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
  dataRevision: number;
  smsEnabled: boolean;
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
  setSmsEnabled: (enabled: boolean) => void;
  bumpDataRevision: () => void;
}

type AppState = AuthSlice & UISlice & DataSlice & { resetAppState: () => void };

// ─── Initial Values ──────────────────────────────────────────────────────────

const initialAuthState: Pick<
  AuthSlice,
  'isLocked' | 'biometricsEnabled' | 'biometricsPrompted' | 'pinEnabled' | 'userProfile'
> = {
  isLocked: true,
  biometricsEnabled: false,
  biometricsPrompted: false,
  pinEnabled: false,
  userProfile: null,
};

const initialUIState: Pick<
  UISlice,
  'isLoading' | 'theme' | 'notificationPreferences' | 'selectedMonth'
> = {
  isLoading: false,
  theme: 'system',
  notificationPreferences: {
    enabled: false,
    dailyReminder: false,
    budgetAlerts: true,
    monthlyReportReminder: true,
  },
  selectedMonth: new Date().toISOString().slice(0, 7),
};

const initialDataState: Pick<
  DataSlice,
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
  | 'dataRevision'
  | 'smsEnabled'
> = {
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
  dataRevision: 0,
  smsEnabled: false,
};

// ─── Slice Creators ──────────────────────────────────────────────────────────

let revisionTimer: ReturnType<typeof setTimeout> | undefined;

const createAuthSlice: StateCreator<AppState, [], [], AuthSlice> = (set) => ({
  ...initialAuthState,
  setLocked: (locked) => set({ isLocked: locked }),
  setBiometrics: (enabled) => set({ biometricsEnabled: enabled }),
  setBiometricsPrompted: (prompted) => set({ biometricsPrompted: prompted }),
  setUserProfile: (userProfile) => set({ userProfile }),
});

const createUISlice: StateCreator<AppState, [], [], UISlice> = (set) => ({
  ...initialUIState,
  setLoading: (isLoading) => set({ isLoading }),
  setTheme: (theme) => set({ theme }),
  setNotificationPreferences: (notificationPreferences) => set({ notificationPreferences }),
  setSelectedMonth: (selectedMonth) => set({ selectedMonth }),
});

const createDataSlice: StateCreator<AppState, [], [], DataSlice> = (set) => ({
  ...initialDataState,
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
  setSmsEnabled: (smsEnabled) => set({ smsEnabled }),
  bumpDataRevision: () => {
    clearTimeout(revisionTimer);
    revisionTimer = setTimeout(() => {
      set((state) => ({ dataRevision: state.dataRevision + 1 }));
    }, 100);
  },
});

// ─── Combined Store ──────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((...a) => ({
  ...createAuthSlice(...a),
  ...createUISlice(...a),
  ...createDataSlice(...a),
  resetAppState: () => a[0]({ ...initialAuthState, ...initialUIState, ...initialDataState }),
}));
