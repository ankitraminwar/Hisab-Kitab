import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Bar, CartesianChart, Line } from 'victory-native';
import { useFont } from '@shopify/react-native-skia';
import { format } from 'date-fns';

import { Card, SectionHeader } from '@/components/common';
import { TransactionService } from '@/services/transactionService';
import { useAppStore } from '@/store/appStore';
import {
  COLORS,
  SPACING,
  TYPOGRAPHY,
  formatCompact,
  formatCurrency,
} from '@/utils/constants';

type TrendDatum = {
  month: string;
  income: number;
  expense: number;
};

type CategoryDatum = {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  total: number;
};

export default function ReportsScreen() {
  const now = new Date();
  const dataRevision = useAppStore((state) => state.dataRevision);
  const font = useFont(undefined, 12);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(
    String(now.getMonth() + 1).padStart(2, '0'),
  );
  const [expenseBreakdown, setExpenseBreakdown] = useState<CategoryDatum[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<TrendDatum[]>([]);
  const [stats, setStats] = useState({ income: 0, expense: 0 });

  useEffect(() => {
    const loadData = async () => {
      const [expenseData, trendData, monthStats] = await Promise.all([
        TransactionService.getCategoryBreakdown(year, month, 'expense'),
        TransactionService.getMonthlyTrend(6),
        TransactionService.getMonthlyStats(year, month),
      ]);

      setExpenseBreakdown(expenseData);
      setMonthlyTrend(trendData);
      setStats(monthStats);
    };

    void loadData();
  }, [dataRevision, month, year]);

  const savingsRate =
    stats.income > 0
      ? ((stats.income - stats.expense) / stats.income) * 100
      : 0;
  const topExpenseData = expenseBreakdown.slice(0, 5).map((item) => ({
    label: item.categoryName,
    total: item.total,
  }));

  const prevMonth = () => {
    const date = new Date(year, Number(month) - 2, 1);
    setYear(date.getFullYear());
    setMonth(String(date.getMonth() + 1).padStart(2, '0'));
  };

  const nextMonth = () => {
    const date = new Date(year, Number(month), 1);
    setYear(date.getFullYear());
    setMonth(String(date.getMonth() + 1).padStart(2, '0'));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
      </View>

      <View style={styles.monthPicker}>
        <TouchableOpacity onPress={prevMonth} style={styles.monthButton}>
          <Ionicons
            name="chevron-back"
            size={20}
            color={COLORS.textSecondary}
          />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {format(new Date(year, Number(month) - 1), 'MMMM yyyy')}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={styles.monthButton}>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={COLORS.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Income</Text>
            <Text style={[styles.statValue, { color: COLORS.income }]}>
              {formatCompact(stats.income)}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Expense</Text>
            <Text style={[styles.statValue, { color: COLORS.expense }]}>
              {formatCompact(stats.expense)}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Savings</Text>
            <Text
              style={[
                styles.statValue,
                { color: savingsRate >= 0 ? COLORS.income : COLORS.expense },
              ]}
            >
              {savingsRate.toFixed(1)}%
            </Text>
          </Card>
        </View>

        {monthlyTrend.length > 0 && (
          <Card style={styles.chartCard}>
            <SectionHeader title="6-Month Trend" />
            <CartesianChart
              data={monthlyTrend}
              xKey="month"
              yKeys={['income', 'expense']}
              axisOptions={{
                font,
                labelColor: COLORS.textMuted,
                lineColor: COLORS.border,
              }}
              domainPadding={{ left: 20, right: 20, top: 24 }}
            >
              {({ points, chartBounds }) => (
                <>
                  <Bar
                    points={points.income}
                    chartBounds={chartBounds}
                    color={`${COLORS.income}99`}
                  />
                  <Line
                    points={points.expense}
                    color={COLORS.expense}
                    strokeWidth={3}
                  />
                </>
              )}
            </CartesianChart>
          </Card>
        )}

        {topExpenseData.length > 0 && (
          <Card style={styles.chartCard}>
            <SectionHeader title="Top Expenses" />
            <CartesianChart
              data={topExpenseData}
              xKey="label"
              yKeys={['total']}
              axisOptions={{
                font,
                labelColor: COLORS.textMuted,
                lineColor: COLORS.border,
              }}
              domainPadding={{ left: 24, right: 24, top: 24 }}
            >
              {({ points, chartBounds }) => (
                <Bar
                  points={points.total}
                  chartBounds={chartBounds}
                  color={`${COLORS.primary}CC`}
                />
              )}
            </CartesianChart>
          </Card>
        )}

        {expenseBreakdown.length > 0 && (
          <Card style={styles.chartCard}>
            <SectionHeader title="Expense Breakdown" />
            {expenseBreakdown.slice(0, 8).map((item) => {
              const percentage =
                stats.expense > 0 ? (item.total / stats.expense) * 100 : 0;
              return (
                <View key={item.categoryId} style={styles.breakdownRow}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: item.categoryColor || COLORS.primary },
                    ]}
                  />
                  <Text style={styles.breakdownName} numberOfLines={1}>
                    {item.categoryName}
                  </Text>
                  <Text style={styles.breakdownPercent}>
                    {percentage.toFixed(1)}%
                  </Text>
                  <Text style={styles.breakdownAmount}>
                    {formatCurrency(item.total)}
                  </Text>
                </View>
              );
            })}
          </Card>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  title: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary },
  monthPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  monthButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  monthLabel: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    minWidth: 140,
    textAlign: 'center',
  },
  scroll: { paddingHorizontal: SPACING.md },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: SPACING.md },
  statLabel: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  statValue: { ...TYPOGRAPHY.h3, fontWeight: '700' },
  chartCard: { marginBottom: SPACING.md },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  breakdownName: { ...TYPOGRAPHY.body, color: COLORS.textPrimary, flex: 1 },
  breakdownPercent: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    width: 44,
    textAlign: 'right',
  },
  breakdownAmount: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
    width: 88,
    textAlign: 'right',
  },
  bottomSpacer: { height: 80 },
});
