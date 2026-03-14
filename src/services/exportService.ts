import { documentDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { DataService } from '@/services/dataServices';
import { TransactionService } from '@/services/transactionService';

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
  exportFullBackupJson: async () => {
    const payload = await DataService.exportAllData();
    return shareFile(
      'hisab-kitab-backup.json',
      JSON.stringify(payload, null, 2),
      'application/json',
    );
  },
};
