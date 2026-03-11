import { cacheDirectory, writeAsStringAsync } from 'expo-file-system';
import React, { useEffect, useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet } from 'react-native';

import { getFinancialSummary } from '@/modules/reports/financialService';
import { getTransactions } from '@/modules/transactions/transactionsService';
import { asCSV, asJSON } from '@/modules/export/exportService';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

export default function ReportsScreen() {
  const [summary, setSummary] = useState<any>(null);
  const theme = useTheme();

  useEffect(() => {
    (async () => {
      const fin = await getFinancialSummary();
      setSummary(fin);
    })();
  }, []);

  const exportAll = async (format: 'csv' | 'json') => {
    const tx = await getTransactions();
    const content = format === 'csv' ? asCSV(tx) : asJSON(tx);
    const fileUri = `${cacheDirectory}trackbuddy-transactions.${format}`;
    await writeAsStringAsync(fileUri, content);
    Alert.alert('Exported', `Saved to ${fileUri}`);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      <ThemedText type="title">Reports</ThemedText>
      {summary ? (
        <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText>Total Income: ₹{summary.totalIncome.toFixed(2)}</ThemedText>
          <ThemedText>Total Expense: ₹{summary.totalExpense.toFixed(2)}</ThemedText>
          <ThemedText>Net Worth: ₹{summary.netWorth.toFixed(2)}</ThemedText>
          <ThemedText>Savings Rate: {(summary.savingsRate * 100).toFixed(1)}%</ThemedText>
        </ThemedView>
      ) : (
        <ThemedText>Loading...</ThemedText>
      )}
      <Button title="Export CSV" onPress={() => exportAll('csv').catch((err) => Alert.alert('Error', String(err)))} />
      <Button title="Export JSON" onPress={() => exportAll('json').catch((err) => Alert.alert('Error', String(err)))} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  card: { borderRadius: 10, padding: 14 },
});
