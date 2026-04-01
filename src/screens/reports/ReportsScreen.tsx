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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedEmptyState } from '../../components/common';
import { InteractiveLineChart } from '../../components/charts/InteractiveLineChart';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { TransactionService } from '../../services/transactionService';
import { useAppStore } from '../../store/appStore';
import { RADIUS, SPACING, TYPOGRAPHY, formatCompact, formatCurrency } from '../../utils/constants';

import type { ChartDataPoint } from '../../utils/types';

const SCREEN_WIDTH = Dimensions.get('window').width;

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
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Swipe tab state
  const tabScrollRef = useRef<Animated.ScrollView>(null);
  const scrollX = useSharedValue(SCREEN_WIDTH);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
    onMomentumEnd: (event) => {
      const idx = Math.round(event.contentOffset.x / SCREEN_WIDTH);
      runOnJS(setPeriod)(PERIOD_TABS[idx] as Period);
      runOnJS(setAnchor)(new Date());
    },
  });

  const handleTabPress = (tab: Period) => {
    const idx = PERIOD_TABS.indexOf(tab);
    setPeriod(tab);
    setAnchor(new Date());
    tabScrollRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: true });
  };

  // Animated tab indicator
  const TAB_CONTAINER_WIDTH = SCREEN_WIDTH - SPACING.md * 2;
  const TAB_WIDTH = TAB_CONTAINER_WIDTH / 3;

  const indicatorStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      scrollX.value,
      [0, SCREEN_WIDTH, SCREEN_WIDTH * 2],
      [0, TAB_WIDTH, TAB_WIDTH * 2],
      Extrapolation.CLAMP,
    );
    return { transform: [{ translateX }] };
  });

  // Pre-create animated text styles for each tab (can't call hooks in a loop)
  const textStyle0 = useAnimatedStyle(() => {
    const active = interpolate(
      scrollX.value,
      [-SCREEN_WIDTH * 0.5, 0, SCREEN_WIDTH * 0.5],
      [0, 1, 0],
      Extrapolation.CLAMP,
    );
    return { color: active > 0.5 ? colors.textInverse : colors.textSecondary };
  });
  const textStyle1 = useAnimatedStyle(() => {
    const active = interpolate(
      scrollX.value,
      [SCREEN_WIDTH * 0.5, SCREEN_WIDTH, SCREEN_WIDTH * 1.5],
      [0, 1, 0],
      Extrapolation.CLAMP,
    );
    return { color: active > 0.5 ? colors.textInverse : colors.textSecondary };
  });
  const textStyle2 = useAnimatedStyle(() => {
    const active = interpolate(
      scrollX.value,
      [SCREEN_WIDTH * 1.5, SCREEN_WIDTH * 2, SCREEN_WIDTH * 2.5],
      [0, 1, 0],
      Extrapolation.CLAMP,
    );
    return { color: active > 0.5 ? colors.textInverse : colors.textSecondary };
  });
  const tabTextStyles = [textStyle0, textStyle1, textStyle2];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Financial Analytics"
        rightAction={{
          icon: 'share-outline',
          onPress: () => {
            const range = getDateRange(period, anchor);
            router.push(
              `/reports/preview?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}&label=${encodeURIComponent(range.label)}&period=${encodeURIComponent(period.toLowerCase())}&focus=pdf` as Href,
            );
          },
        }}
      />

      {/* Animated Liquid Tabs */}
      <View style={styles.tabContainer}>
        <Animated.View style={[styles.tabIndicatorPill, indicatorStyle]} />
        {PERIOD_TABS.map((tab, idx) => (
          <TouchableOpacity
            key={tab}
            style={styles.tabBtn}
            onPress={() => handleTabPress(tab as Period)}
            activeOpacity={0.8}
          >
            <Animated.Text style={[styles.tabText, tabTextStyles[idx]]}>{tab}</Animated.Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Horizontal paging scroll for tab content */}
      <Animated.ScrollView
        ref={tabScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        style={{ flex: 1 }}
        bounces={false}
        // Start on Monthly (index 1)
        contentOffset={{ x: SCREEN_WIDTH, y: 0 }}
      >
        {PERIOD_TABS.map((tab) => (
          <ReportContent
            key={tab}
            period={tab as Period}
            isActive={period === tab}
            colors={colors}
            styles={styles}
            dataRevision={dataRevision}
            showAllCategories={showAllCategories}
            onToggleShowAll={() => setShowAllCategories((prev) => !prev)}
            onAnchorChange={(a) => {
              if (period === tab) setAnchor(a);
            }}
          />
        ))}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

/* ---------- Sub-components ---------- */

// ─── Report Content (one per tab page) ────────────────────────────────────────
const ReportContent: React.FC<{
  period: Period;
  isActive: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  dataRevision: number;
  showAllCategories: boolean;
  onToggleShowAll: () => void;
  onAnchorChange: (anchor: Date) => void;
}> = ({
  period,
  isActive,
  colors,
  styles,
  dataRevision,
  showAllCategories,
  onToggleShowAll,
  onAnchorChange,
}) => {
  const [anchor, setAnchor] = useState(new Date());
  const [expenseBreakdown, setExpenseBreakdown] = useState<CategoryDatum[]>([]);
  const [stats, setStats] = useState({ income: 0, expense: 0 });
  const [prevStats, setPrevStats] = useState({ income: 0, expense: 0 });
  const [expenseChartData, setExpenseChartData] = useState<ChartDataPoint[]>([]);
  const [incomeChartData, setIncomeChartData] = useState<ChartDataPoint[]>([]);

  const range = useMemo(() => getDateRange(period, anchor), [period, anchor]);
  const prevRange = useMemo(() => {
    const prevAnchor = shiftAnchor(period, anchor, -1);
    return getDateRange(period, prevAnchor);
  }, [period, anchor]);

  const loadData = useCallback(async () => {
    const [breakdown, currentStats, previousStats, dailyTotals] = await Promise.all([
      TransactionService.getCategoryBreakdownByDateRange(range.from, range.to, 'expense'),
      TransactionService.getStatsByDateRange(range.from, range.to),
      TransactionService.getStatsByDateRange(prevRange.from, prevRange.to),
      TransactionService.getDailyTotals(range.from, range.to),
    ]);
    setExpenseBreakdown(breakdown);
    setStats(currentStats);
    setPrevStats(previousStats);

    // Build chart data points from daily totals
    setExpenseChartData(
      dailyTotals.map((d) => ({
        timestamp: new Date(d.date).getTime(),
        value: d.expense,
      })),
    );
    setIncomeChartData(
      dailyTotals.map((d) => ({
        timestamp: new Date(d.date).getTime(),
        value: d.income,
      })),
    );
  }, [range, prevRange]);

  useEffect(() => {
    if (isActive) {
      void loadData();
    }
  }, [loadData, dataRevision, isActive]);

  const savings = stats.income - stats.expense;
  const savingsRate = stats.income > 0 ? (savings / stats.income) * 100 : 0;
  const incomeTrend =
    prevStats.income > 0 ? ((stats.income - prevStats.income) / prevStats.income) * 100 : 0;
  const expenseTrend =
    prevStats.expense > 0 ? ((stats.expense - prevStats.expense) / prevStats.expense) * 100 : 0;
  const hasData = stats.income > 0 || stats.expense > 0;

  const navigatePeriod = useCallback(
    (direction: 1 | -1) => {
      setAnchor((prev) => {
        const next = shiftAnchor(period, prev, direction);
        onAnchorChange(next);
        return next;
      });
    },
    [period, onAnchorChange],
  );

  const displayedCategories = showAllCategories ? expenseBreakdown : expenseBreakdown.slice(0, 5);

  return (
    <ScrollView
      style={{ width: SCREEN_WIDTH }}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* Period Navigation */}
      <View style={styles.periodNav}>
        <TouchableOpacity
          onPress={() => navigatePeriod(-1)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Previous period"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.periodLabel}>{range.label}</Text>
        <TouchableOpacity
          onPress={() => navigatePeriod(1)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Next period"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {!hasData ? (
        <View style={{ paddingVertical: SPACING.xxl }}>
          <AnimatedEmptyState
            icon="bar-chart-outline"
            title="No data for this period"
            subtitle={`No income or expenses recorded for ${range.label}. Try selecting a different time period.`}
          />
        </View>
      ) : (
        <>
          {/* Summary Cards */}
          <View style={styles.summaryRow}>
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
          </View>

          {/* Income vs Expenses */}
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

          {/* Expense Trend Chart */}
          {expenseChartData.length >= 1 && (
            <View style={{ marginTop: SPACING.md }}>
              <InteractiveLineChart
                data={expenseChartData}
                title="Expense Trend"
                color={colors.expense}
                height={180}
              />
            </View>
          )}

          {/* Income Trend Chart */}
          {incomeChartData.length >= 1 && (
            <View style={{ marginTop: SPACING.md }}>
              <InteractiveLineChart
                data={incomeChartData}
                title="Income Trend"
                color={colors.income}
                height={180}
              />
            </View>
          )}

          {/* Spending Categories */}
          {expenseBreakdown.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {showAllCategories ? 'All' : 'Top'} Spending Categories
                </Text>
                {expenseBreakdown.length > 5 && (
                  <TouchableOpacity onPress={onToggleShowAll}>
                    <Text style={[styles.viewAll, { color: colors.primary }]}>
                      {showAllCategories ? 'Show Less' : 'View All'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={{ gap: SPACING.sm }}>
                {displayedCategories.map((item) => {
                  const percentage = stats.expense > 0 ? (item.total / stats.expense) * 100 : 0;
                  const catColor = item.categoryColor || colors.primary;
                  return (
                    <View key={item.categoryId} style={styles.catCard}>
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
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.catAmount}>{formatCurrency(item.total)}</Text>
                            <Text style={[styles.catPercent, { color: catColor }]}>
                              {percentage.toFixed(1)}%
                            </Text>
                          </View>
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
                  );
                })}
              </View>
            </>
          )}
        </>
      )}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

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

    // Tabs
    tabContainer: {
      flexDirection: 'row',
      marginHorizontal: SPACING.md,
      marginVertical: SPACING.sm,
      position: 'relative',
      backgroundColor: colors.bgElevated,
      borderRadius: RADIUS.md,
      overflow: 'hidden',
    },
    tabIndicatorPill: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: (SCREEN_WIDTH - SPACING.md * 2) / 3,
      backgroundColor: colors.primary,
      borderRadius: RADIUS.md,
      zIndex: 0,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: RADIUS.md,
      backgroundColor: 'transparent',
      zIndex: 1,
    },
    tabText: {
      ...TYPOGRAPHY.body,
      fontWeight: '600',
    },

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
    catPercent: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 1,
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
