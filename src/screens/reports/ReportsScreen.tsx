import { Ionicons } from '@expo/vector-icons';
import {
  addDays,
  addMonths,
  addYears,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';
import { router, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PeriodTabs } from '../../components/common/PeriodTabs';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { TransactionService } from '../../services/transactionService';
import { useAppStore } from '../../store/appStore';
import { RADIUS, SPACING, TYPOGRAPHY, formatCompact, formatCurrency } from '../../utils/constants';

type CategoryDatum = {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon?: string;
  total: number;
};

const PERIOD_TABS = ['Weekly', 'Monthly', 'Yearly'];

type Period = 'Weekly' | 'Monthly' | 'Yearly';

function getDateRange(period: Period, anchor: Date): { from: string; to: string; label: string } {
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
  switch (period) {
    case 'Weekly': {
      const start = startOfWeek(anchor, { weekStartsOn: 1 });
      const end = endOfWeek(anchor, { weekStartsOn: 1 });
      return {
        from: fmt(start),
        to: fmt(end),
        label: `${format(start, 'dd MMM')} – ${format(end, 'dd MMM yyyy')}`,
      };
    }
    case 'Monthly': {
      const start = startOfMonth(anchor);
      const end = endOfMonth(anchor);
      return {
        from: fmt(start),
        to: fmt(end),
        label: format(anchor, 'MMMM yyyy'),
      };
    }
    case 'Yearly': {
      const start = startOfYear(anchor);
      const end = endOfYear(anchor);
      return {
        from: fmt(start),
        to: fmt(end),
        label: format(anchor, 'yyyy'),
      };
    }
  }
}

function shiftAnchor(period: Period, anchor: Date, direction: 1 | -1): Date {
  switch (period) {
    case 'Weekly':
      return direction === 1 ? addDays(anchor, 7) : subDays(anchor, 7);
    case 'Monthly':
      return direction === 1 ? addMonths(anchor, 1) : subMonths(anchor, 1);
    case 'Yearly':
      return direction === 1 ? addYears(anchor, 1) : subYears(anchor, 1);
  }
}

export default function ReportsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dataRevision = useAppStore((state) => state.dataRevision);

  const [period, setPeriod] = useState<Period>('Monthly');
  const [anchor, setAnchor] = useState(new Date());
  const [expenseBreakdown, setExpenseBreakdown] = useState<CategoryDatum[]>([]);
  const [stats, setStats] = useState({ income: 0, expense: 0 });
  const [prevStats, setPrevStats] = useState({ income: 0, expense: 0 });

  const range = useMemo(() => getDateRange(period, anchor), [period, anchor]);
  const prevRange = useMemo(() => {
    const prevAnchor = shiftAnchor(period, anchor, -1);
    return getDateRange(period, prevAnchor);
  }, [period, anchor]);

  const loadData = useCallback(async () => {
    const [breakdown, currentStats, previousStats] = await Promise.all([
      TransactionService.getCategoryBreakdownByDateRange(range.from, range.to, 'expense'),
      TransactionService.getStatsByDateRange(range.from, range.to),
      TransactionService.getStatsByDateRange(prevRange.from, prevRange.to),
    ]);
    setExpenseBreakdown(breakdown);
    setStats(currentStats);
    setPrevStats(previousStats);
  }, [range, prevRange]);

  useEffect(() => {
    void loadData();
  }, [loadData, dataRevision]);

  const savings = stats.income - stats.expense;
  const savingsRate = stats.income > 0 ? (savings / stats.income) * 100 : 0;

  const incomeTrend =
    prevStats.income > 0 ? ((stats.income - prevStats.income) / prevStats.income) * 100 : 0;
  const expenseTrend =
    prevStats.expense > 0 ? ((stats.expense - prevStats.expense) / prevStats.expense) * 100 : 0;

  const handlePeriodChange = (tab: string) => {
    setPeriod(tab as Period);
    setAnchor(new Date());
  };

  const openPreview = () => {
    router.push(
      `/reports/preview?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}&label=${encodeURIComponent(range.label)}&period=${encodeURIComponent(period.toLowerCase())}&focus=pdf` as Href,
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Financial Analytics"
        rightAction={{
          icon: 'share-outline',
          onPress: openPreview,
        }}
      />

      {/* Period Tabs */}
      <PeriodTabs tabs={PERIOD_TABS} activeTab={period} onTabChange={handlePeriodChange} />

      {/* Period Navigation */}
      <View style={styles.periodNav}>
        <TouchableOpacity
          onPress={() => setAnchor(shiftAnchor(period, anchor, -1))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.periodLabel}>{range.label}</Text>
        <TouchableOpacity
          onPress={() => setAnchor(shiftAnchor(period, anchor, 1))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Summary Cards */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.summaryRow}>
          <SummaryCard
            label="Income"
            value={formatCompact(stats.income)}
            trendLabel={`${Math.abs(incomeTrend).toFixed(0)}%`}
            trendUp={incomeTrend >= 0}
            colors={colors}
            tintColor={colors.primary}
          />
          <SummaryCard
            label="Expenses"
            value={formatCompact(stats.expense)}
            trendLabel={`${Math.abs(expenseTrend).toFixed(0)}%`}
            trendUp={expenseTrend <= 0}
            colors={colors}
            tintColor={colors.expense}
          />
          <SummaryCard
            label="Savings"
            value={formatCompact(savings)}
            trendLabel={`${Math.abs(savingsRate).toFixed(0)}%`}
            trendUp={savings >= 0}
            colors={colors}
            tintColor={colors.income}
          />
        </Animated.View>

        {/* Income vs Expenses */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Income vs Expenses</Text>
            <View style={{ gap: 20, marginTop: 8 }}>
              <BarRow
                label="Income"
                amount={formatCurrency(stats.income)}
                percent={
                  Math.max(stats.income, stats.expense) > 0
                    ? (stats.income / Math.max(stats.income, stats.expense)) * 100
                    : 0
                }
                color={colors.income}
                barBg={colors.bgElevated}
                textColor={colors.textPrimary}
                mutedColor={colors.textMuted}
              />
              <BarRow
                label="Expenses"
                amount={formatCurrency(stats.expense)}
                percent={
                  Math.max(stats.income, stats.expense) > 0
                    ? (stats.expense / Math.max(stats.income, stats.expense)) * 100
                    : 0
                }
                color={colors.expense}
                barBg={colors.bgElevated}
                textColor={colors.textPrimary}
                mutedColor={colors.textMuted}
              />
            </View>
          </View>
        </Animated.View>

        {/* Top Spending Categories */}
        {expenseBreakdown.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(200)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top Spending Categories</Text>
              <TouchableOpacity>
                <Text style={[styles.viewAll, { color: colors.primary }]}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={{ gap: SPACING.sm }}>
              {expenseBreakdown.slice(0, 5).map((item, index) => {
                const percentage = stats.expense > 0 ? (item.total / stats.expense) * 100 : 0;
                const catColor = item.categoryColor || colors.primary;
                return (
                  <Animated.View
                    key={item.categoryId}
                    entering={FadeInDown.duration(400).delay(300 + index * 60)}
                  >
                    <View style={styles.catCard}>
                      <View
                        style={[
                          styles.catIcon,
                          {
                            backgroundColor: catColor + '15',
                            borderColor: catColor + '30',
                          },
                        ]}
                      >
                        <Ionicons
                          name={(item.categoryIcon || 'ellipse') as never}
                          size={22}
                          color={catColor}
                        />
                      </View>
                      <View style={styles.catContent}>
                        <View style={styles.catTopRow}>
                          <Text style={styles.catName}>{item.categoryName}</Text>
                          <Text style={styles.catAmount}>{formatCurrency(item.total)}</Text>
                        </View>
                        <View style={styles.catBarBg}>
                          <View
                            style={[
                              styles.catBarFill,
                              {
                                width: `${Math.min(percentage, 100)}%`,
                                backgroundColor: catColor,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- Sub-components ---------- */

const SummaryCard: React.FC<{
  label: string;
  value: string;
  trendLabel: string;
  trendUp: boolean;
  colors: ThemeColors;
  tintColor: string;
}> = ({ label, value, trendLabel, trendUp, colors, tintColor }) => (
  <View
    style={[
      summaryStyles.card,
      {
        backgroundColor: tintColor + '10',
        borderColor: tintColor + '20',
      },
    ]}
  >
    <Text style={[summaryStyles.label, { color: colors.textMuted }]}>{label}</Text>
    <Text style={[summaryStyles.value, { color: tintColor }]}>{value}</Text>
    <View style={summaryStyles.trend}>
      <Ionicons
        name={trendUp ? 'trending-up' : 'trending-down'}
        size={12}
        color={trendUp ? colors.income : colors.expense}
      />
      <Text style={[summaryStyles.trendText, { color: trendUp ? colors.income : colors.expense }]}>
        {trendLabel}
      </Text>
    </View>
  </View>
);

const BarRow: React.FC<{
  label: string;
  amount: string;
  percent: number;
  color: string;
  barBg: string;
  textColor: string;
  mutedColor: string;
}> = ({ label, amount, percent, color, barBg, textColor, mutedColor }) => (
  <View>
    <View style={barStyles.labelRow}>
      <Text style={[barStyles.label, { color: mutedColor }]}>{label}</Text>
      <Text style={[barStyles.amount, { color: textColor }]}>{amount}</Text>
    </View>
    <View style={[barStyles.barBg, { backgroundColor: barBg }]}>
      <View
        style={[barStyles.barFill, { width: `${Math.min(percent, 100)}%`, backgroundColor: color }]}
      />
    </View>
  </View>
);

/* ---------- Styles ---------- */

const summaryStyles = StyleSheet.create({
  card: {
    flex: 1,
    gap: 4,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
  },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

const barStyles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: { fontSize: 12, fontWeight: '500' },
  amount: { fontSize: 12, fontWeight: '700' },
  barBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
});

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingHorizontal: SPACING.md },
    periodNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
    },
    periodLabel: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    summaryRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      paddingVertical: SPACING.md,
    },
    card: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: SPACING.md,
    },
    cardTitle: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.md,
      marginTop: SPACING.sm,
      paddingHorizontal: 2,
    },
    sectionTitle: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    viewAll: { fontSize: 12, fontWeight: '700' },
    catCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      backgroundColor: colors.bgCard,
      padding: SPACING.md,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    catIcon: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    catContent: { flex: 1 },
    catTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    catName: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    catAmount: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    catBarBg: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.bgElevated,
      overflow: 'hidden',
    },
    catBarFill: {
      height: '100%',
      borderRadius: 3,
    },
  });
