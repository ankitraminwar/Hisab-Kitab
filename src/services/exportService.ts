import * as DocumentPicker from 'expo-document-picker';
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

const shareFile = async (
  filename: string,
  content: string,
  mimeType: string,
) => {
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

export const exportService = {
  exportTransactionsCsv: async () => {
    const csv = await TransactionService.exportToCSV();
    return shareFile('hisab-kitab-transactions.csv', csv, 'text/csv');
  },
  exportTransactionsPdf: async () => {
    const transactions = await TransactionService.getAll(undefined, 10000, 0);
    const now = new Date();
    const stats = await TransactionService.getMonthlyStats(
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
    );

    const fmtDate = (iso: string) =>
      new Date(iso).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    const fmtAmt = (n: number) =>
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(n);

    const rows = transactions
      .slice(0, 500)
      .map(
        (t) =>
          `<tr>
            <td>${fmtDate(t.date)}</td>
            <td>${t.categoryName ?? '-'}</td>
            <td>${t.type}</td>
            <td style="text-align:right;color:${t.type === 'income' ? '#10B981' : '#EF4444'}">${fmtAmt(t.amount)}</td>
            <td>${t.accountName ?? '-'}</td>
            <td>${t.notes ?? ''}</td>
          </tr>`,
      )
      .join('');

    const net = stats.income - stats.expense;
    const html = `<html><head><style>
      body{font-family:-apple-system,sans-serif;padding:24px;color:#1a1a2e}
      h1{font-size:22px;color:#6C63FF;margin-bottom:4px}
      .sub{color:#64748b;font-size:13px;margin-bottom:20px}
      .row{display:flex;gap:16px;margin-bottom:20px}
      .stat{padding:12px 16px;border-radius:8px;background:#f1f5f9}
      .sl{font-size:11px;color:#64748b}.sv{font-size:18px;font-weight:700}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#f1f5f9;padding:8px;text-align:left;font-weight:600;border-bottom:2px solid #e2e8f0}
      td{padding:6px 8px;border-bottom:1px solid #f1f5f9}
      tr:nth-child(even){background:#fafafe}
    </style></head><body>
      <h1>Hisab Kitab — Transaction Report</h1>
      <div class="sub">Generated ${fmtDate(now.toISOString())}</div>
      <div class="row">
        <div class="stat"><div class="sl">Income (This Month)</div><div class="sv" style="color:#10B981">${fmtAmt(stats.income)}</div></div>
        <div class="stat"><div class="sl">Expenses (This Month)</div><div class="sv" style="color:#EF4444">${fmtAmt(stats.expense)}</div></div>
        <div class="stat"><div class="sl">Net</div><div class="sv" style="color:${net >= 0 ? '#10B981' : '#EF4444'}">${fmtAmt(net)}</div></div>
      </div>
      <table><thead><tr><th>Date</th><th>Category</th><th>Type</th><th style="text-align:right">Amount</th><th>Account</th><th>Notes</th></tr></thead>
      <tbody>${rows}</tbody></table>
      ${transactions.length > 500 ? `<p style="color:#94a3b8;font-size:11px;margin-top:12px">Showing 500 of ${transactions.length} transactions.</p>` : ''}
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
