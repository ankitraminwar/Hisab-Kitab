import {
  cacheDirectory,
  documentDirectory,
  moveAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { DataService } from '../services/dataServices';
import { TransactionService } from '../services/transactionService';
import type { Transaction } from '../utils/types';

const shareFile = async (filename: string, content: string, mimeType: string) => {
  if (!documentDirectory) {
    throw new Error('Local file storage is unavailable');
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

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const formatAmount = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toCsvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const buildExportData = async () => {
  const transactions = await TransactionService.getAll(undefined, 10000, 0);

  const stats = transactions.reduce(
    (accumulator, transaction) => {
      if (transaction.type === 'income') {
        accumulator.income += transaction.amount;
      }
      if (transaction.type === 'expense') {
        accumulator.expense += transaction.amount;
      }
      return accumulator;
    },
    { income: 0, expense: 0, net: 0 },
  );
  stats.net = stats.income - stats.expense;

  const categorySpending = transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((map, transaction) => {
      const key = transaction.categoryName ?? 'Uncategorized';
      const entry = map.get(key) ?? { category: key, amount: 0, count: 0 };
      entry.amount += transaction.amount;
      entry.count += 1;
      map.set(key, entry);
      return map;
    }, new Map<string, { category: string; amount: number; count: number }>());

  return {
    transactions,
    stats,
    categorySpending: [...categorySpending.values()].sort((a, b) => b.amount - a.amount),
  };
};

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

export const exportService = {
  exportTransactionsCsv: async () => {
    const { transactions, stats, categorySpending } = await buildExportData();
    const generatedAt = new Date().toISOString();

    const csv = [
      ['Hisab Kitab Export'].map(toCsvCell).join(','),
      ['Generated At', generatedAt].map(toCsvCell).join(','),
      ['Total Income', stats.income].map(toCsvCell).join(','),
      ['Total Expense', stats.expense].map(toCsvCell).join(','),
      ['Net', stats.net].map(toCsvCell).join(','),
      '',
      ['Category-wise Spending'].map(toCsvCell).join(','),
      ['Category', 'Amount', 'Transactions'].map(toCsvCell).join(','),
      ...categorySpending.map((entry) =>
        [entry.category, entry.amount, entry.count].map(toCsvCell).join(','),
      ),
      '',
      ['All Transactions'].map(toCsvCell).join(','),
      buildTransactionCsv(transactions),
    ].join('\n');

    return shareFile('hisab-kitab-transactions.csv', csv, 'text/csv');
  },

  exportTransactionsPdf: async () => {
    const { transactions, stats, categorySpending } = await buildExportData();
    const now = new Date();

    const categoryRows = categorySpending
      .map(
        (entry) => `<tr>
          <td>${escapeHtml(entry.category)}</td>
          <td style="text-align:right">${entry.count}</td>
          <td style="text-align:right;color:#EF4444">${escapeHtml(formatAmount(entry.amount))}</td>
        </tr>`,
      )
      .join('');

    const transactionRows = transactions
      .map(
        (transaction) => `<tr>
          <td>${escapeHtml(formatDate(transaction.date))}</td>
          <td>${escapeHtml(transaction.categoryName ?? '-')}</td>
          <td>${escapeHtml(transaction.type)}</td>
          <td style="text-align:right;color:${transaction.type === 'income' ? '#10B981' : transaction.type === 'expense' ? '#EF4444' : '#6366F1'}">${escapeHtml(formatAmount(transaction.amount))}</td>
          <td>${escapeHtml(transaction.accountName ?? '-')}</td>
          <td>${escapeHtml(transaction.merchant ?? '-')}</td>
          <td>${escapeHtml(transaction.notes ?? '')}</td>
        </tr>`,
      )
      .join('');

    const html = `<html><head><style>
      body{font-family:-apple-system,sans-serif;padding:24px;color:#1a1a2e}
      h1{font-size:22px;color:#6C63FF;margin-bottom:4px}
      h2{font-size:16px;color:#0f172a;margin:24px 0 12px}
      .sub{color:#64748b;font-size:13px;margin-bottom:20px}
      .row{display:flex;gap:16px;margin-bottom:20px}
      .stat{padding:12px 16px;border-radius:8px;background:#f1f5f9}
      .sl{font-size:11px;color:#64748b}.sv{font-size:18px;font-weight:700}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#f1f5f9;padding:8px;text-align:left;font-weight:600;border-bottom:2px solid #e2e8f0}
      td{padding:6px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}
      tr:nth-child(even){background:#fafafe}
    </style></head><body>
      <h1>Hisab Kitab - Transaction Report</h1>
      <div class="sub">Generated ${formatDate(now.toISOString())}</div>
      <div class="row">
        <div class="stat"><div class="sl">Total Income</div><div class="sv" style="color:#10B981">${formatAmount(stats.income)}</div></div>
        <div class="stat"><div class="sl">Total Expense</div><div class="sv" style="color:#EF4444">${formatAmount(stats.expense)}</div></div>
        <div class="stat"><div class="sl">Net</div><div class="sv" style="color:${stats.net >= 0 ? '#10B981' : '#EF4444'}">${formatAmount(stats.net)}</div></div>
      </div>
      <h2>Category-wise Spending</h2>
      <table><thead><tr><th>Category</th><th style="text-align:right">Transactions</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${categoryRows || '<tr><td colspan="3">No expense transactions found.</td></tr>'}</tbody></table>
      <h2>All Transactions</h2>
      <table><thead><tr><th>Date</th><th>Category</th><th>Type</th><th style="text-align:right">Amount</th><th>Account</th><th>Merchant</th><th>Notes</th></tr></thead>
      <tbody>${transactionRows || '<tr><td colspan="7">No transactions found.</td></tr>'}</tbody></table>
    </body></html>`;

    const { uri } = await Print.printToFileAsync({ html });
    const fileName = `HisabKitab_Report_${now.toISOString().slice(0, 10)}.pdf`;
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
