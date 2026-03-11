import { Link } from 'expo-router';
import { VictoryBar, VictoryChart, VictoryPie } from 'victory-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FinancialSummary, getFinancialSummary } from '@/modules/reports/financialService';
import { getTransactions } from '@/modules/transactions/transactionsService';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

export default function DashboardScreen() {
  const [summary, setSummary] = useState<FinancialSummary>({
    totalIncome: 0,
    totalExpense: 0,
    totalBalance: 0,
    savingsRate: 0,
    netWorth: 0,
    budgets: [],
    goalsProgress: [],
  });
  const [transactions, setTransactions] = useState<any[]>([]);
  const theme = useTheme();

  useEffect(() => {
    (async () => {
      const fin = await getFinancialSummary();
      setSummary(fin);
      const tx = await getTransactions();
      setTransactions(tx);
    })();
  }, []);

  const spendSummary = useMemo(() => {
    const byCategory: Record<string, number> = {};
    transactions.forEach((t) => {
      if (t.type === 'expense') {
        const cat = t.categoryId || 'Other';
        byCategory[cat] = (byCategory[cat] || 0) + t.amount;
      }
    });
    return Object.entries(byCategory).map(([category, amount]) => ({ x: category, y: amount }));
  }, [transactions]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}> 
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedView style={styles.card}>
          <ThemedText type="title">Dashboard</ThemedText>
          <ThemedText>Total Balance: ₹{summary.totalBalance.toFixed(2)}</ThemedText>
          <ThemedText>Total Income: ₹{summary.totalIncome.toFixed(2)}</ThemedText>
          <ThemedText>Total Expense: ₹{summary.totalExpense.toFixed(2)}</ThemedText>
          <ThemedText>Savings Rate: {(summary.savingsRate * 100).toFixed(1)}%</ThemedText>
          <ThemedText>Net Worth: ₹{summary.netWorth.toFixed(2)}</ThemedText>
        </ThemedView>

        <ThemedView style={styles.card}>
          <ThemedText type="subtitle">Expense Breakdown</ThemedText>
          <VictoryPie
            width={320}
            height={240}
            data={spendSummary.length ? spendSummary : [{ x: 'No Data', y: 1 }]}
            innerRadius={40}
            labelRadius={80}
            style={{ labels: { display: 'none' } }}
          />
        </ThemedView>

        <ThemedView style={styles.card}>
          <ThemedText type="subtitle">Monthly Trend</ThemedText>
          <VictoryChart width={350} height={250} domainPadding={20}>
            <VictoryBar
              data={spendSummary.length ? spendSummary.slice(0, 12) : [{ x: 'No Data', y: 1 }]}
              style={{ data: { fill: '#208AEF' } }}
              x="x"
              y="y"
            />
          </VictoryChart>
        </ThemedView>

        <View style={styles.actionsRow}>
          <Link href="/explore" style={styles.link}>Transactions</Link>
          <Link href="/accounts" style={styles.link}>Accounts</Link>
          <Link href="/budgets" style={styles.link}>Budgets</Link>
          <Link href="/goals" style={styles.link}>Goals</Link>
          <Link href="/assets" style={styles.link}>Assets</Link>
          <Link href="/liabilities" style={styles.link}>Liabilities</Link>
          <Link href="/reports" style={styles.link}>Reports</Link>
          <Link href="/settings" style={styles.link}>Settings</Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  card: { borderRadius: 14, padding: 16, minHeight: 160 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  link: { color: '#208AEF', margin: 4, padding: 8, borderRadius: 8, backgroundColor: '#E3F2FD' },
});
