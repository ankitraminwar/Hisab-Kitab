import { supabase } from '../lib/supabase';
import {
  buildReportDocumentData,
  createCurrentMonthReportInput,
  formatReportAmount,
} from './reportExportService';

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

/** Send a monthly summary email report via Supabase Edge Function */
export async function sendMonthlyReport(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const session = await supabase.auth.getSession();
  const email = session.data.session?.user?.email;
  if (!email) {
    return { ok: false, error: 'No email address found. Please log in.' };
  }

  const input = createCurrentMonthReportInput();
  const report = await buildReportDocumentData(input);

  const { error } = await supabase.functions.invoke('send-email', {
    body: {
      to: email,
      subject: `Hisab Kitab - ${report.input.label} Financial Statement`,
      title: `Your ${report.input.label} Financial Statement`,
      previewText: `Balance ${formatReportAmount(report.totalBalance)}, income ${formatReportAmount(report.income)}, expenses ${formatReportAmount(report.expense)}.`,
      intro:
        'Your monthly statement is ready with the same summary, budget view, and spending highlights you see inside the app.',
      monthLabel: report.input.label,
      reportRange: `${report.input.from} to ${report.input.to}`,
      summary: {
        totalBalance: formatReportAmount(report.totalBalance),
        income: formatReportAmount(report.income),
        expenses: formatReportAmount(report.expense),
        savings: formatReportAmount(report.savings),
        savingsRate: formatPercent(report.savingsRate),
        transactionCount: `${report.transactions.length}`,
      },
      spendingBreakdown: report.categoryBreakdown.slice(0, 5).map((category) => ({
        name: category.categoryName,
        amount: formatReportAmount(category.total),
        percentage: Number(category.percentage.toFixed(1)),
        color: category.categoryColor || '#7C3AED',
      })),
      budgetPerformance: report.budgets.slice(0, 5).map((budget) => ({
        name: budget.categoryName || 'Budget',
        limit: formatReportAmount(budget.limitAmount),
        spent: formatReportAmount(budget.spent),
        statusLabel: budget.statusLabel,
        statusTone: budget.statusTone,
      })),
      recentTransactions: report.transactions.slice(0, 5).map((transaction) => ({
        title: transaction.merchant || transaction.categoryName || 'Transaction',
        subtitle: `${new Date(transaction.date).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })}${transaction.accountName ? ` - ${transaction.accountName}` : ''}`,
        amount: `${transaction.type === 'expense' ? '-' : transaction.type === 'income' ? '+' : ''}${formatReportAmount(transaction.amount)}`,
        tone:
          transaction.type === 'income'
            ? 'income'
            : transaction.type === 'expense'
              ? 'expense'
              : 'neutral',
      })),
      ctaLabel: 'Open Reports',
      ctaUrl: 'hisabkitab://reports',
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
