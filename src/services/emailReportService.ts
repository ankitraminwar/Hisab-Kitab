import { AccountService } from './dataService';
import { supabase } from '../lib/supabase';
import { TransactionService } from './transactionService';

const formatCurr = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);

const formatPercent = (n: number) => `${n.toFixed(1)}%`;

/** Send a monthly summary email report via Supabase Edge Function */
export async function sendMonthlyReport(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const session = await supabase.auth.getSession();
  const email = session.data.session?.user?.email;
  if (!email) return { ok: false, error: 'No email address found. Please log in.' };

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthLabel = now.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
  const monthShort = now.toLocaleDateString('en-IN', {
    month: 'short',
  });
  const monthStart = `${year}-${month}-01`;
  const monthEnd = new Date(year, Number(month), 0).toISOString().slice(0, 10);

  const [stats, breakdown, accounts, topExpenses] = await Promise.all([
    TransactionService.getMonthlyStats(year, month),
    TransactionService.getCategoryBreakdown(year, month, 'expense'),
    AccountService.getAll(),
    TransactionService.getAll({ type: 'expense', dateFrom: monthStart, dateTo: monthEnd }, 3, 0),
  ]);

  const net = stats.income - stats.expense;
  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const savingsRate = stats.income > 0 ? (Math.max(net, 0) / stats.income) * 100 : 0;
  const totalSaved = Math.max(net, 0);
  const totalExpense = stats.expense || 0;

  const spendingBreakdown = breakdown.slice(0, 4).map((category) => ({
    name: category.categoryName,
    amount: formatCurr(category.total),
    percentage: totalExpense > 0 ? Math.round((category.total / totalExpense) * 100) : 0,
    color: category.categoryColor || '#1d4ed8',
  }));

  const topSpending = topExpenses.map((item) => ({
    title: item.merchant || item.categoryName || 'Expense',
    subtitle: new Date(item.date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    amount: formatCurr(item.amount),
    categoryName: item.categoryName || 'General',
  }));

  const { error } = await supabase.functions.invoke('send-email', {
    body: {
      to: email,
      subject: `Hisab Kitab - ${monthLabel} Summary`,
      title: `Your ${monthLabel} Summary`,
      previewText: `Balance ${formatCurr(totalBalance)}, income ${formatCurr(stats.income)}, expenses ${formatCurr(stats.expense)}.`,
      intro: `Here is your complete financial snapshot for ${monthLabel}, styled like a polished product report and filled with your actual app data.`,
      monthLabel,
      monthShort,
      summary: {
        totalBalance: formatCurr(totalBalance),
        savingsRate: formatPercent(savingsRate),
        totalSaved: formatCurr(totalSaved),
        accountCount: `${accounts.length}`,
      },
      stats: {
        income: formatCurr(stats.income),
        expenses: formatCurr(stats.expense),
        net: formatCurr(net),
      },
      spendingBreakdown,
      topSpending,
      ctaLabel: 'View Full Report',
      ctaUrl: 'hisabkitab:///',
    },
  });

  console.log('Email report sent:', { email, error });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
