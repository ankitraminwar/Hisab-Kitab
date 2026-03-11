import { create } from 'zustand';
import { Account, Category, Transaction, Budget, Goal, Asset, Liability, DashboardStats } from '../utils/types';

interface AppState {
  // Auth
  isLocked: boolean;
  biometricsEnabled: boolean;
  pinEnabled: boolean;

  // Data
  accounts: Account[];
  categories: Category[];
  recentTransactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  assets: Asset[];
  liabilities: Liability[];
  dashboardStats: DashboardStats;

  // UI
  isLoading: boolean;
  theme: 'dark' | 'light';
  selectedMonth: string; // 'YYYY-MM'

  // Actions
  setLocked: (locked: boolean) => void;
  setBiometrics: (enabled: boolean) => void;
  setAccounts: (accounts: Account[]) => void;
  setCategories: (categories: Category[]) => void;
  setRecentTransactions: (transactions: Transaction[]) => void;
  setBudgets: (budgets: Budget[]) => void;
  setGoals: (goals: Goal[]) => void;
  setAssets: (assets: Asset[]) => void;
  setLiabilities: (liabilities: Liability[]) => void;
  setDashboardStats: (stats: DashboardStats) => void;
  setLoading: (loading: boolean) => void;
  setSelectedMonth: (month: string) => void;
  updateAccountBalance: (accountId: string, delta: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isLocked: true,
  biometricsEnabled: false,
  pinEnabled: false,
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
  selectedMonth: new Date().toISOString().slice(0, 7),

  setLocked: (locked) => set({ isLocked: locked }),
  setBiometrics: (enabled) => set({ biometricsEnabled: enabled }),
  setAccounts: (accounts) => set({ accounts }),
  setCategories: (categories) => set({ categories }),
  setRecentTransactions: (recentTransactions) => set({ recentTransactions }),
  setBudgets: (budgets) => set({ budgets }),
  setGoals: (goals) => set({ goals }),
  setAssets: (assets) => set({ assets }),
  setLiabilities: (liabilities) => set({ liabilities }),
  setDashboardStats: (dashboardStats) => set({ dashboardStats }),
  setLoading: (isLoading) => set({ isLoading }),
  setSelectedMonth: (selectedMonth) => set({ selectedMonth }),
  updateAccountBalance: (accountId, delta) =>
    set((state) => ({
      accounts: state.accounts.map((acc) =>
        acc.id === accountId ? { ...acc, balance: acc.balance + delta } : acc
      ),
    })),
}));
