import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns';

import { AccountService, BudgetService } from '@/services/dataServices';
import { TransactionService } from '@/services/transactionService';
import { formatCurrency } from '@/utils/constants';
import type { Budget, Transaction } from '@/utils/types';

export type ReportPeriod = 'weekly' | 'monthly' | 'yearly';

export type ReportExportInput = {
  from: string;
  to: string;
  label: string;
  period: ReportPeriod;
};

export type ReportTrend = {
  value: number;
  isPositive: boolean;
  label: string;
};

export type ReportCategory = {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon?: string;
  total: number;
  percentage: number;
};

export type ReportBudgetRow = Budget & {
  remaining: number;
  progress: number;
  statusLabel: string;
  statusTone: 'good' | 'warn' | 'danger';
};

export type ReportDocumentData = {
  input: ReportExportInput;
  generatedAt: string;
  totalBalance: number;
  income: number;
  expense: number;
  savings: number;
  savingsRate: number;
  incomeTrend: ReportTrend | null;
  expenseTrend: ReportTrend | null;
  categoryBreakdown: ReportCategory[];
  budgets: ReportBudgetRow[];
  transactions: Transaction[];
};

const LARGE_EXPORT_LIMIT = 10000;

const getPreviousRange = (input: ReportExportInput): { from: string; to: string } => {
  const anchor = new Date(`${input.from}T00:00:00`);

  switch (input.period) {
    case 'weekly': {
      const previous = subWeeks(anchor, 1);
      return {
        from: format(startOfWeek(previous, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        to: format(endOfWeek(previous, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    }
    case 'yearly': {
      const previous = subYears(anchor, 1);
      return {
        from: format(startOfYear(previous), 'yyyy-MM-dd'),
        to: format(endOfYear(previous), 'yyyy-MM-dd'),
      };
    }
    case 'monthly':
    default: {
      const previous = subMonths(anchor, 1);
      return {
        from: format(startOfMonth(previous), 'yyyy-MM-dd'),
        to: format(endOfMonth(previous), 'yyyy-MM-dd'),
      };
    }
  }
};

const buildTrend = (
  currentValue: number,
  previousValue: number,
  positiveWhenHigher: boolean,
): ReportTrend | null => {
  if (previousValue <= 0) {
    return null;
  }

  const delta = ((currentValue - previousValue) / previousValue) * 100;
  const magnitude = Math.abs(delta);
  const isPositive = positiveWhenHigher ? delta >= 0 : delta <= 0;

  return {
    value: magnitude,
    isPositive,
    label: `${magnitude.toFixed(0)}% vs previous ${positiveWhenHigher ? 'period' : 'period'}`,
  };
};

const buildBudgetRows = (budgets: Budget[]): ReportBudgetRow[] =>
  budgets.map((budget) => {
    const remaining = budget.limitAmount - budget.spent;
    const progress = budget.limitAmount > 0 ? budget.spent / budget.limitAmount : 0;

    let statusLabel = 'On Track';
    let statusTone: ReportBudgetRow['statusTone'] = 'good';

    if (progress >= 1) {
      statusLabel = 'Over Budget';
      statusTone = 'danger';
    } else if (progress >= 0.8) {
      statusLabel = 'Near Limit';
      statusTone = 'warn';
    }

    return {
      ...budget,
      remaining,
      progress,
      statusLabel,
      statusTone,
    };
  });

export const createCurrentMonthReportInput = (): ReportExportInput => {
  const now = new Date();
  return {
    from: format(startOfMonth(now), 'yyyy-MM-dd'),
    to: format(endOfMonth(now), 'yyyy-MM-dd'),
    label: format(now, 'MMMM yyyy'),
    period: 'monthly',
  };
};

export const buildReportDocumentData = async (
  input: ReportExportInput,
): Promise<ReportDocumentData> => {
  const previousRange = getPreviousRange(input);

  const [transactions, currentStats, previousStats, categoryBreakdown, totalBalance, budgets] =
    await Promise.all([
      TransactionService.getAll(
        {
          dateFrom: input.from,
          dateTo: input.to,
        },
        LARGE_EXPORT_LIMIT,
        0,
      ),
      TransactionService.getStatsByDateRange(input.from, input.to),
      TransactionService.getStatsByDateRange(previousRange.from, previousRange.to),
      TransactionService.getCategoryBreakdownByDateRange(input.from, input.to, 'expense'),
      AccountService.getTotalBalance(),
      input.period === 'monthly'
        ? BudgetService.getForMonth(Number(input.from.slice(0, 4)), input.from.slice(5, 7))
        : Promise.resolve([]),
    ]);

  const savings = currentStats.income - currentStats.expense;
  const savingsRate = currentStats.income > 0 ? (savings / currentStats.income) * 100 : 0;
  const expenseTotal = currentStats.expense || 0;

  return {
    input,
    generatedAt: new Date().toISOString(),
    totalBalance,
    income: currentStats.income,
    expense: currentStats.expense,
    savings,
    savingsRate,
    incomeTrend: buildTrend(currentStats.income, previousStats.income, true),
    expenseTrend: buildTrend(currentStats.expense, previousStats.expense, false),
    categoryBreakdown: categoryBreakdown.map((category) => ({
      ...category,
      percentage: expenseTotal > 0 ? (category.total / expenseTotal) * 100 : 0,
    })),
    budgets: buildBudgetRows(budgets),
    transactions,
  };
};

export const formatReportAmount = (amount: number) => formatCurrency(amount);
