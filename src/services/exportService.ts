import {
  cacheDirectory,
  documentDirectory,
  moveAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { DataService } from '@/services/dataServices';
import {
  buildReportDocumentData,
  createCurrentMonthReportInput,
  formatReportAmount,
  type ReportDocumentData,
  type ReportExportInput,
} from '@/services/reportExportService';
import type { Transaction } from '@/utils/types';
import { logger } from '@/utils/logger';

const shareFile = async (filename: string, content: string, mimeType: string) => {
  if (!documentDirectory) {
    logger.error('ExportService', 'Local file storage is unavailable');
    return;
  }

  const fileUri = `${documentDirectory}${filename}`;
  await writeAsStringAsync(fileUri, content);

  if (!(await Sharing.isAvailableAsync())) {
    return fileUri;
  }

  await Sharing.shareAsync(fileUri, {
    dialogTitle: filename,
    mimeType,
  });

  return fileUri;
};

const isValidDate = (d: Date) => !isNaN(d.getTime());

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return isValidDate(d)
    ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : iso || '—';
};

const formatGeneratedAt = (iso: string) => {
  const d = new Date(iso);
  return isValidDate(d)
    ? d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : iso || '—';
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toCsvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const getToneColors = (isDark: boolean) =>
  isDark
    ? {
        bg: '#0F0F1A',
        card: '#1E1E2E',
        cardAlt: '#2D2D44',
        surface: '#151523',
        border: '#31314A',
        text: '#F8FAFC',
        muted: '#94A3B8',
        subtle: '#64748B',
        primary: '#8B5CF6',
        primarySoft: '#C4B5FD',
        income: '#10B981',
        expense: '#F43F5E',
        warning: '#F59E0B',
      }
    : {
        bg: '#F7F6F8',
        card: '#FFFFFF',
        cardAlt: '#F4F1FB',
        surface: '#F8FAFC',
        border: '#E5E7EB',
        text: '#0F172A',
        muted: '#64748B',
        subtle: '#94A3B8',
        primary: '#7C3AED',
        primarySoft: '#DDD6FE',
        income: '#059669',
        expense: '#E11D48',
        warning: '#D97706',
      };

const getStatusColors = (
  tone: 'good' | 'warn' | 'danger',
  isDark: boolean,
): { bg: string; text: string } => {
  if (tone === 'danger') {
    return isDark
      ? { bg: 'rgba(244,63,94,0.18)', text: '#FDA4AF' }
      : { bg: '#FFE4E6', text: '#BE123C' };
  }

  if (tone === 'warn') {
    return isDark
      ? { bg: 'rgba(245,158,11,0.18)', text: '#FCD34D' }
      : { bg: '#FEF3C7', text: '#B45309' };
  }

  return isDark
    ? { bg: 'rgba(16,185,129,0.18)', text: '#6EE7B7' }
    : { bg: '#DCFCE7', text: '#15803D' };
};

const buildLogoMarkup = (primary: string, income: string) => `
  <div style="width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg, ${primary}, ${income}); display: flex; align-items: center; justify-content: center;">
    <span style="color: white; font-weight: 900; font-size: 26px; font-family: sans-serif; letter-spacing: -1px; line-height: 1;">HK</span>
  </div>
`;

const buildTransactionCsv = (transactions: Transaction[]) => {
  const header = [
    'Date',
    'Category',
    'Type',
    'Amount',
    'Account',
    'Merchant',
    'Notes',
    'Payment Method',
    'Tags',
  ];

  return [
    header.map(toCsvCell).join(','),
    ...transactions.map((transaction) =>
      [
        transaction.date,
        transaction.categoryName ?? '',
        transaction.type,
        transaction.amount,
        transaction.accountName ?? '',
        transaction.merchant ?? '',
        transaction.notes ?? '',
        transaction.paymentMethod ?? '',
        transaction.tags.join(';'),
      ]
        .map(toCsvCell)
        .join(','),
    ),
  ].join('\n');
};

const buildReportCsv = (report: ReportDocumentData) =>
  [
    ['Hisab Kitab Report'].map(toCsvCell).join(','),
    ['Period', report.input.label].map(toCsvCell).join(','),
    ['From', report.input.from].map(toCsvCell).join(','),
    ['To', report.input.to].map(toCsvCell).join(','),
    ['Generated At', report.generatedAt].map(toCsvCell).join(','),
    ['Total Balance', report.totalBalance].map(toCsvCell).join(','),
    ['Income', report.income].map(toCsvCell).join(','),
    ['Expense', report.expense].map(toCsvCell).join(','),
    ['Savings', report.savings].map(toCsvCell).join(','),
    ['Savings Rate', `${report.savingsRate.toFixed(1)}%`].map(toCsvCell).join(','),
    '',
    ['Budget Performance'].map(toCsvCell).join(','),
    ['Category', 'Budget', 'Spent', 'Remaining', 'Status'].map(toCsvCell).join(','),
    ...report.budgets.map((budget) =>
      [
        budget.categoryName ?? 'Budget',
        budget.limitAmount,
        budget.spent,
        budget.remaining,
        budget.statusLabel,
      ]
        .map(toCsvCell)
        .join(','),
    ),
    '',
    ['Top Spending Categories'].map(toCsvCell).join(','),
    ['Category', 'Amount', 'Share'].map(toCsvCell).join(','),
    ...report.categoryBreakdown.map((category) =>
      [category.categoryName, category.total, `${category.percentage.toFixed(1)}%`]
        .map(toCsvCell)
        .join(','),
    ),
    '',
    ['All Transactions'].map(toCsvCell).join(','),
    buildTransactionCsv(report.transactions),
  ].join('\n');

const buildReportHtml = async (report: ReportDocumentData, isDark: boolean) => {
  const colors = getToneColors(isDark);
  const logoMarkup = buildLogoMarkup(colors.primary, colors.income);

  const summaryCards = [
    {
      label: 'Total Balance',
      value: formatReportAmount(report.totalBalance),
      accent: colors.primary,
      sublabel: 'Available across accounts',
    },
    {
      label: 'Income',
      value: formatReportAmount(report.income),
      accent: colors.income,
      sublabel: report.incomeTrend?.label ?? 'No prior comparison',
    },
    {
      label: 'Expenses',
      value: formatReportAmount(report.expense),
      accent: colors.expense,
      sublabel: report.expenseTrend?.label ?? 'No prior comparison',
    },
    {
      label: 'Savings',
      value: formatReportAmount(report.savings),
      accent: report.savings >= 0 ? colors.income : colors.expense,
      sublabel: `${report.savingsRate.toFixed(0)}% saving rate`,
    },
  ]
    .map(
      (card) => `<div class="summary-card">
        <div class="summary-label">${escapeHtml(card.label)}</div>
        <div class="summary-value" style="color:${card.accent}">${escapeHtml(card.value)}</div>
        <div class="summary-sub">${escapeHtml(card.sublabel)}</div>
      </div>`,
    )
    .join('');

  const budgetRows = report.budgets.length
    ? report.budgets
        .map((budget) => {
          const statusColors = getStatusColors(budget.statusTone, isDark);
          return `<tr>
            <td>
              <div class="table-title">${escapeHtml(budget.categoryName ?? 'Budget')}</div>
            </td>
            <td class="align-right">${escapeHtml(formatReportAmount(budget.limitAmount))}</td>
            <td class="align-right">${escapeHtml(formatReportAmount(budget.spent))}</td>
            <td>
              <span class="status-pill" style="background:${statusColors.bg};color:${statusColors.text}">
                ${escapeHtml(budget.statusLabel)}
              </span>
            </td>
          </tr>`;
        })
        .join('')
    : `<tr><td colspan="4" class="empty-cell">No budgets created for this period.</td></tr>`;

  const categoryRows = report.categoryBreakdown.length
    ? report.categoryBreakdown
        .slice(0, 6)
        .map(
          (category) => `<tr>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 12px; height: 12px; border-radius: 6px; background-color: ${category.categoryColor || colors.primary};"></div>
                <div class="table-title">${escapeHtml(category.categoryName)}</div>
              </div>
            </td>
            <td class="align-right">${escapeHtml(formatReportAmount(category.total))}</td>
            <td class="align-right">${category.percentage.toFixed(1)}%</td>
          </tr>`,
        )
        .join('')
    : `<tr><td colspan="3" class="empty-cell">No spending categories found for this period.</td></tr>`;

  const transactionRows = report.transactions.length
    ? report.transactions
        .map((transaction) => {
          const amountColor =
            transaction.type === 'income'
              ? colors.income
              : transaction.type === 'expense'
                ? colors.expense
                : colors.primary;
          const amountValue =
            transaction.type === 'income'
              ? formatReportAmount(transaction.amount)
              : transaction.type === 'expense'
                ? `-${formatReportAmount(transaction.amount)}`
                : formatReportAmount(transaction.amount);

          return `<tr>
            <td>${escapeHtml(formatDate(transaction.date))}</td>
            <td>
              <div style="display: flex; align-items: flex-start; gap: 10px;">
                <div style="width: 10px; height: 10px; border-radius: 5px; background-color: ${transaction.categoryColor || colors.primary}; margin-top: 4px; flex-shrink: 0;"></div>
                <div>
                  <div class="table-title">${escapeHtml(transaction.merchant || transaction.categoryName || 'Transaction')}</div>
                  <div class="table-sub">${escapeHtml(transaction.categoryName || transaction.type)}</div>
                </div>
              </div>
            </td>
            <td>${escapeHtml(transaction.accountName || '-')}</td>
            <td>${escapeHtml(transaction.paymentMethod || '-')}</td>
            <td class="align-right" style="color:${amountColor};font-weight:700">${escapeHtml(amountValue)}</td>
          </tr>`;
        })
        .join('')
    : `<tr><td colspan="5" class="empty-cell">No transactions found in this period.</td></tr>`;

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        :root {
          color-scheme: ${isDark ? 'dark' : 'light'};
        }
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          padding: 32px 24px 40px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: ${colors.bg};
          color: ${colors.text};
        }
        .page {
          max-width: 1040px;
          margin: 0 auto;
        }
        .hero {
          background: linear-gradient(135deg, ${colors.card}, ${colors.cardAlt});
          border: 1px solid ${colors.border};
          border-radius: 28px;
          padding: 28px;
          margin-bottom: 16px;
        }
        .hero-top {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          margin-bottom: 24px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .brand-mark {
          width: 56px;
          height: 56px;
          border-radius: 18px;
          background: rgba(124,58,237,0.14);
          border: 1px solid rgba(124,58,237,0.28);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .brand-name {
          font-size: 26px;
          font-weight: 800;
          margin: 0;
        }
        .eyebrow {
          margin: 0 0 6px;
          color: ${colors.muted};
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.2px;
          text-transform: uppercase;
        }
        .hero-title {
          margin: 0;
          font-size: 34px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }
        .hero-subtitle {
          margin: 8px 0 0;
          color: ${colors.muted};
          font-size: 14px;
        }
        .report-chip {
          display: inline-block;
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(16,185,129,0.16);
          color: ${colors.income};
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .generated {
          margin-top: 10px;
          font-size: 12px;
          color: ${colors.muted};
          text-align: right;
        }
        .summary-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .summary-card {
          flex: 1 1 calc(25% - 12px);
          min-width: 160px;
          background: ${colors.surface};
          border: 1px solid ${colors.border};
          border-radius: 20px;
          padding: 16px;
        }
        .summary-label {
          color: ${colors.muted};
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .summary-value {
          margin-top: 12px;
          font-size: 26px;
          font-weight: 800;
        }
        .summary-sub {
          margin-top: 8px;
          color: ${colors.muted};
          font-size: 12px;
        }
        .section {
          background: ${colors.card};
          border: 1px solid ${colors.border};
          border-radius: 24px;
          padding: 24px;
          margin-top: 14px;
        }
        .section-title {
          margin: 0 0 4px;
          font-size: 22px;
          font-weight: 800;
        }
        .section-subtitle {
          margin: 0 0 18px;
          color: ${colors.muted};
          font-size: 13px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        thead th {
          text-align: left;
          padding: 14px 12px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: ${colors.muted};
          border-bottom: 1px solid ${colors.border};
        }
        tbody td {
          padding: 14px 12px;
          border-bottom: 1px solid ${colors.border};
          vertical-align: top;
          font-size: 13px;
        }
        tbody tr:last-child td {
          border-bottom: none;
        }
        .table-title {
          font-weight: 700;
        }
        .table-sub {
          margin-top: 4px;
          color: ${colors.muted};
          font-size: 12px;
        }
        .align-right {
          text-align: right;
        }
        .status-pill {
          display: inline-flex;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
        }
        .empty-cell {
          color: ${colors.muted};
          font-style: italic;
        }
        .footer {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          margin-top: 20px;
          color: ${colors.muted};
          font-size: 12px;
        }
        @media print {
          body {
            padding: 12px;
          }
          .section {
            page-break-inside: avoid;
          }
          tbody tr {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <section class="hero">
          <div class="hero-top">
            <div>
              <div class="brand">
                <div class="brand-mark">${logoMarkup}</div>
                <div>
                  <p class="eyebrow">Personal Finance Report</p>
                  <p class="brand-name">Hisab Kitab</p>
                </div>
              </div>
              <h1 class="hero-title">${escapeHtml(report.input.label)} Financial Statement</h1>
              <p class="hero-subtitle">
                Reporting period: ${escapeHtml(report.input.from)} to ${escapeHtml(report.input.to)}
              </p>
            </div>
            <div style="text-align: right;">
              <div class="generated">Generated on ${escapeHtml(formatGeneratedAt(report.generatedAt))}</div>
              <div style="margin-top: 16px; padding: 12px 16px; background: ${colors.cardAlt}; border-radius: 12px; border: 1px dashed ${colors.border}; max-width: 260px; display: inline-block; text-align: left;">
                <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: ${colors.primary}; margin-bottom: 4px; letter-spacing: 0.5px;">Keep Going</div>
                <div style="font-size: 13px; color: ${colors.text}; line-height: 1.4; font-weight: 500;">Every rupee saved today is a step toward your financial freedom tomorrow.</div>
              </div>
            </div>
          </div>
          <div class="summary-grid">${summaryCards}</div>
        </section>

        <section class="section">
          <h2 class="section-title">Budget Performance</h2>
          <p class="section-subtitle">Monthly budget status aligned with your tracked spending.</p>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th class="align-right">Budget</th>
                <th class="align-right">Spent</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${budgetRows}</tbody>
          </table>
        </section>

        <section class="section">
          <h2 class="section-title">Top Spending Categories</h2>
          <p class="section-subtitle">Largest expense buckets for the selected report period.</p>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th class="align-right">Amount</th>
                <th class="align-right">Share</th>
              </tr>
            </thead>
            <tbody>${categoryRows}</tbody>
          </table>
        </section>

        <section class="section">
          <h2 class="section-title">All Transactions</h2>
          <p class="section-subtitle">Every transaction captured in this report period, in one ledger.</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Transaction</th>
                <th>Account</th>
                <th>Method</th>
                <th class="align-right">Amount</th>
              </tr>
            </thead>
            <tbody>${transactionRows}</tbody>
          </table>
        </section>

        <div class="footer">
          <div>${escapeHtml(`Transactions included: ${report.transactions.length}`)}</div>
          <div>${escapeHtml('Generated by Hisab Kitab')}</div>
        </div>
      </div>
    </body>
  </html>`;
};

const resolveReport = async (
  input?: ReportExportInput,
  reportData?: ReportDocumentData,
): Promise<ReportDocumentData> => {
  if (reportData) {
    return reportData;
  }

  return buildReportDocumentData(input ?? createCurrentMonthReportInput());
};

export const exportService = {
  exportTransactionsCsv: async (input?: ReportExportInput, reportData?: ReportDocumentData) => {
    const report = await resolveReport(input, reportData);
    const csv = buildReportCsv(report);
    const filename = `hisab-kitab-report-${report.input.from}-to-${report.input.to}.csv`;
    return shareFile(filename, csv, 'text/csv');
  },

  exportTransactionsPdf: async (
    input?: ReportExportInput,
    options?: { reportData?: ReportDocumentData; isDark?: boolean },
  ) => {
    const report = await resolveReport(input, options?.reportData);
    const html = await buildReportHtml(report, Boolean(options?.isDark));
    const { uri } = await Print.printToFileAsync({ html });
    const fileName = `HisabKitab_Report_${report.input.from}_to_${report.input.to}.pdf`;
    const newUri = `${cacheDirectory}${fileName}`;
    await moveAsync({ from: uri, to: newUri });
    await Sharing.shareAsync(newUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Export Report',
    });
    return newUri;
  },

  exportFullBackupJson: async () => {
    const payload = await DataService.exportAllData();
    return shareFile(
      'hisab-kitab-backup.json',
      JSON.stringify(payload, null, 2),
      'application/json',
    );
  },

  importBackupJson: async (): Promise<{ imported: number } | null> => {
    const DocumentPicker = await import('expo-document-picker');
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return null;

    const fileUri = result.assets[0].uri;
    const content = await readAsStringAsync(fileUri);
    const data = JSON.parse(content) as Record<string, unknown[]>;

    return DataService.importAllData(data);
  },
};
