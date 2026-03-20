import { supabase } from '../lib/supabase';
import { TransactionService } from './transactionService';

const formatCurr = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);

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

  const [stats, breakdown] = await Promise.all([
    TransactionService.getMonthlyStats(year, month),
    TransactionService.getCategoryBreakdown(year, month, 'expense'),
  ]);

  const net = stats.income - stats.expense;
  const topCategories = breakdown
    .slice(0, 5)
    .map((c, i) => `${i + 1}. ${c.categoryName}: ${formatCurr(c.total)}`)
    .join('<br/>');

  const body = `
    Here's your financial summary for <strong>${monthLabel}</strong>:<br/><br/>
    💰 <strong>Income:</strong> ${formatCurr(stats.income)}<br/>
    💸 <strong>Expenses:</strong> ${formatCurr(stats.expense)}<br/>
    📊 <strong>Net:</strong> ${formatCurr(net)}<br/><br/>
    <strong>Top Spending Categories:</strong><br/>
    ${topCategories || 'No expenses recorded this month.'}
  `;

  const { error } = await supabase.functions.invoke('send-email', {
    body: {
      to: email,
      subject: `Hisab Kitab — ${monthLabel} Report`,
      title: `Your ${monthLabel} Financial Report`,
      body,
      ctaLabel: 'Open App',
      ctaUrl: 'hisabkitab:///',
    },
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
