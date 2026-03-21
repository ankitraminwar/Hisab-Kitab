import { AccountService, BudgetService, GoalService } from './dataService';
import { TransactionService } from './transactionService';

export interface WidgetExpenseSummary {
  totalExpense: number;
  totalIncome: number;
  topCategories: { name: string; amount: number; color: string }[];
  monthLabel: string;
}

export interface WidgetBudgetHealth {
  budgets: { name: string; spent: number; limit: number; color: string }[];
  overallPercent: number;
}

export interface WidgetSavingsGoal {
  name: string;
  current: number;
  target: number;
  percent: number;
  color: string;
  icon: string;
}

export interface WidgetNetWorth {
  totalBalance: number;
  accountCount: number;
}

export const WidgetDataService = {
  /** Expense Summary widget data — current month income/expense + top categories */
  async getExpenseSummary(): Promise<WidgetExpenseSummary> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const monthLabel = now.toLocaleDateString('en-IN', {
      month: 'short',
      year: 'numeric',
    });

    const [stats, breakdown] = await Promise.all([
      TransactionService.getMonthlyStats(year, month),
      TransactionService.getCategoryBreakdown(year, month, 'expense'),
    ]);

    return {
      totalExpense: stats.expense,
      totalIncome: stats.income,
      topCategories: breakdown.slice(0, 4).map((c) => ({
        name: c.categoryName,
        amount: c.total,
        color: c.categoryColor,
      })),
      monthLabel,
    };
  },

  /** Budget Health widget data — budget utilization for current month */
  async getBudgetHealth(): Promise<WidgetBudgetHealth> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    const budgets = await BudgetService.getForMonth(year, month);
    const totalLimit = budgets.reduce((s, b) => s + b.limitAmount, 0);
    const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);

    return {
      budgets: budgets.slice(0, 4).map((b) => ({
        name: b.categoryName ?? 'Budget',
        spent: b.spent,
        limit: b.limitAmount,
        color: b.categoryColor ?? '#8B5CF6',
      })),
      overallPercent: totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0,
    };
  },

  /** Savings Goal widget — top active goal */
  async getTopSavingsGoal(): Promise<WidgetSavingsGoal | null> {
    const goals = await GoalService.getAll();
    const active = goals
      .filter((g) => g.currentAmount < g.targetAmount)
      .sort((a, b) => {
        const aPct = a.targetAmount > 0 ? a.currentAmount / a.targetAmount : 0;
        const bPct = b.targetAmount > 0 ? b.currentAmount / b.targetAmount : 0;
        return bPct - aPct; // most progress first
      });

    if (active.length === 0) return null;
    const g = active[0];
    return {
      name: g.name,
      current: g.currentAmount,
      target: g.targetAmount,
      percent: g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0,
      color: g.color ?? '#7C3AED',
      icon: g.icon ?? 'flag',
    };
  },

  /** Net Worth widget — total balance across all accounts */
  async getNetWorth(): Promise<WidgetNetWorth> {
    const accounts = await AccountService.getAll();
    return {
      totalBalance: accounts.reduce((s, a) => s + a.balance, 0),
      accountCount: accounts.length,
    };
  },
};
