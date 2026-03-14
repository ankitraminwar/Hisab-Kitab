import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import {
  SPACING,
  RADIUS,
  TYPOGRAPHY,
  formatCurrency,
  formatCompact,
} from '../../utils/constants';
import { TransactionService } from '../../services/transactionService';
import {
  AccountService,
  BudgetService,
  NetWorthService,
  CategoryService,
} from '../../services/dataServices';
import { useAppStore } from '../../store/appStore';
import {
  Card,
  SectionHeader,
  ProgressBar,
  EmptyState,
} from '../../components/common';
import TransactionItem from '../../components/TransactionItem';
import type { Budget, Category } from '../../utils/types';
import { useTheme } from '../../hooks/useTheme';

// ─── Donut Chart Component ────────────────────────────────────────────────────
interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

const DonutChart: React.FC<{
  slices: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSublabel?: string;
  colors: { textPrimary: string; textMuted: string; bgElevated: string };
}> = ({
  slices,
  size = 200,
  strokeWidth = 20,
  centerLabel,
  centerSublabel,
  colors,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  let cumulativeOffset = 0;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg
        width={size}
        height={size}
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.bgElevated}
          strokeWidth={strokeWidth}
        />
        {slices.map((slice, index) => {
          const pct = total > 0 ? slice.value / total : 0;
          const dashArray = pct * circumference;
          const dashOffset = -cumulativeOffset * circumference;
          cumulativeOffset += pct;
          return (
            <Circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashArray} ${circumference - dashArray}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
      <View style={StyleSheet.absoluteFill as object}>
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          {centerLabel && (
            <Text
              style={{
                fontSize: 22,
                fontWeight: '800',
                color: colors.textPrimary,
              }}
            >
              {centerLabel}
            </Text>
          )}
          {centerSublabel && (
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: colors.textMuted,
                textTransform: 'uppercase',
                marginTop: 2,
              }}
            >
              {centerSublabel}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

// ─── Budget Alert Card ────────────────────────────────────────────────────────
const BudgetAlertCard: React.FC<{
  budget: Budget;
  colors: ReturnType<typeof useTheme>['colors'];
}> = ({ budget, colors }) => {
  const progress =
    budget.limit_amount > 0 ? budget.spent / budget.limit_amount : 0;
  const remaining = Math.max(0, budget.limit_amount - budget.spent);
  const pct = Math.round(progress * 100);

  return (
    <View
      style={{
        backgroundColor: colors.warning + '10',
        borderLeftWidth: 4,
        borderLeftColor: colors.warning,
        borderRadius: RADIUS.sm,
        padding: SPACING.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Ionicons name="warning" size={22} color={colors.warning} />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            ...TYPOGRAPHY.bodyMedium,
            color: colors.warning,
            fontWeight: '700',
          }}
        >
          Budget Alert
        </Text>
        <Text
          style={{
            ...TYPOGRAPHY.caption,
            color: colors.textSecondary,
            marginTop: 2,
          }}
        >
          {budget.categoryName ?? 'Category'} budget {pct}% used. You have{' '}
          {formatCurrency(remaining)} left.
        </Text>
      </View>
      <View
        style={{
          width: 64,
          height: 6,
          backgroundColor: colors.warning + '30',
          borderRadius: RADIUS.full,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: colors.warning,
            borderRadius: RADIUS.full,
          }}
        />
      </View>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    dashboardStats,
    setDashboardStats,
    recentTransactions,
    setRecentTransactions,
    accounts,
    setAccounts,
    budgets,
    setBudgets,
    dataRevision,
  } = useAppStore();
  const [refreshing, setRefreshing] = useState(false);
  const [spendingSlices, setSpendingSlices] = useState<DonutSlice[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);

  const CHART_COLORS = colors.chart;

  const loadData = useCallback(async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    const [txs, accs, budgetData, nw, monthStats, categories] =
      await Promise.all([
        TransactionService.getAll(undefined, 10),
        AccountService.getAll(),
        BudgetService.getForMonth(year, month),
        NetWorthService.getNetWorth(),
        TransactionService.getMonthlyStats(year, month),
        CategoryService.getAll(),
      ]);

    setRecentTransactions(txs);
    setAccounts(accs);
    setBudgets(budgetData);

    const totalBalance = accs.reduce((sum, a) => sum + a.balance, 0);
    const savingsRate =
      monthStats.income > 0
        ? ((monthStats.income - monthStats.expense) / monthStats.income) * 100
        : 0;

    setDashboardStats({
      totalBalance,
      totalIncome: monthStats.income,
      totalExpenses: monthStats.expense,
      savingsRate,
      netWorth: nw.netWorth,
    });

    // Build spending distribution by category
    const expenseTxs = txs.filter((tx) => tx.type === 'expense');
    const categoryMap = new Map<string, { name: string; total: number }>();
    for (const tx of expenseTxs) {
      const catName = tx.categoryName ?? 'Other';
      const entry = categoryMap.get(catName) ?? { name: catName, total: 0 };
      entry.total += tx.amount;
      categoryMap.set(catName, entry);
    }
    const slices: DonutSlice[] = Array.from(categoryMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 4)
      .map((entry, i) => ({
        label: entry.name,
        value: entry.total,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));
    setSpendingSlices(slices);
    setTotalSpent(monthStats.expense);
  }, [
    CHART_COLORS,
    setAccounts,
    setBudgets,
    setDashboardStats,
    setRecentTransactions,
  ]);

  useEffect(() => {
    void loadData();
  }, [dataRevision, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Find the most over-budget category for the alert
  const alertBudget = budgets.find(
    (b) => b.limit_amount > 0 && b.spent / b.limit_amount >= 0.7,
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.scroll}
      >
        {/* Header */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={styles.header}
        >
          <View style={styles.headerLeft}>
            <View style={styles.logoIcon}>
              <Ionicons name="wallet" size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.appName}>Hisab-Kitab</Text>
              <Text style={styles.welcomeText}>Welcome back, Rahul</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/notifications')}
            style={styles.bellButton}
          >
            <Ionicons
              name="notifications-outline"
              size={22}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Hero Card — Total Balance */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(100)}
          style={styles.heroWrapper}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <Text style={styles.heroLabel}>Total Balance</Text>
            <Text style={styles.heroAmount}>
              {formatCurrency(dashboardStats.totalBalance)}
            </Text>
            <View style={styles.heroBlur} />
          </LinearGradient>
        </Animated.View>

        {/* Income & Expenses Row */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(200)}
          style={styles.statsRow}
        >
          <View
            style={[styles.statTile, { borderColor: colors.income + '20' }]}
          >
            <Text style={[styles.statLabel, { color: colors.income }]}>
              Monthly Income
            </Text>
            <Text style={styles.statAmount}>
              {formatCurrency(dashboardStats.totalIncome)}
            </Text>
          </View>
          <View style={{ width: SPACING.sm }} />
          <View
            style={[styles.statTile, { borderColor: colors.expense + '20' }]}
          >
            <Text style={[styles.statLabel, { color: colors.expense }]}>
              Expenses
            </Text>
            <Text style={styles.statAmount}>
              {formatCurrency(dashboardStats.totalExpenses)}
            </Text>
          </View>
        </Animated.View>

        {/* Total Savings */}
        <Animated.View entering={FadeInDown.duration(500).delay(250)}>
          <View style={styles.savingsCard}>
            <View>
              <Text style={styles.savingsLabel}>TOTAL SAVINGS</Text>
              <Text style={styles.savingsAmount}>
                {formatCurrency(
                  dashboardStats.totalIncome - dashboardStats.totalExpenses,
                )}
              </Text>
            </View>
            <View style={styles.avatarGroup}>
              <View
                style={[
                  styles.avatarCircle,
                  { backgroundColor: colors.primary + '30' },
                ]}
              >
                <Ionicons name="person" size={14} color={colors.primary} />
              </View>
              <View
                style={[
                  styles.avatarCircle,
                  {
                    backgroundColor: colors.primary,
                    marginLeft: -8,
                  },
                ]}
              >
                <Text
                  style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}
                >
                  +2
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Budget Alert */}
        {alertBudget && (
          <Animated.View entering={FadeInDown.duration(500).delay(300)}>
            <BudgetAlertCard budget={alertBudget} colors={colors} />
          </Animated.View>
        )}

        {/* Spending Distribution */}
        <Animated.View entering={FadeInDown.duration(500).delay(350)}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Spending Distribution</Text>
            <TouchableOpacity onPress={() => router.push('/reports')}>
              <Text style={styles.sectionAction}>View Details</Text>
            </TouchableOpacity>
          </View>
          <Card style={styles.donutCard}>
            <DonutChart
              slices={
                spendingSlices.length > 0
                  ? spendingSlices
                  : [{ label: 'No data', value: 1, color: colors.bgElevated }]
              }
              centerLabel={formatCompact(totalSpent)}
              centerSublabel="Total Spent"
              colors={colors}
            />
            <View style={styles.legendGrid}>
              {spendingSlices.map((slice, idx) => (
                <View key={idx} style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: slice.color }]}
                  />
                  <Text style={styles.legendText}>{slice.label}</Text>
                </View>
              ))}
            </View>
          </Card>
        </Animated.View>

        {/* Recent Transactions */}
        <Animated.View entering={FadeInDown.duration(500).delay(400)}>
          <SectionHeader
            title="Recent Transactions"
            action="See All"
            onAction={() => router.push('/transactions')}
          />
          {recentTransactions.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title="No transactions yet"
              subtitle="Tap + to add your first transaction"
            />
          ) : (
            <View style={styles.txList}>
              {recentTransactions.slice(0, 5).map((tx, idx) => (
                <View key={tx.id}>
                  <TransactionItem
                    item={tx}
                    onPress={() => router.push(`/transactions/${tx.id}`)}
                  />
                  {idx < Math.min(recentTransactions.length, 5) - 1 && (
                    <View style={styles.divider} />
                  )}
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },

    // Header
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.lg,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logoIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    appName: { ...TYPOGRAPHY.h3, color: colors.textPrimary, fontWeight: '800' },
    welcomeText: { ...TYPOGRAPHY.caption, color: colors.textMuted },
    bellButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Hero
    heroWrapper: {
      marginBottom: SPACING.md,
      borderRadius: RADIUS.xl,
      overflow: 'hidden',
    },
    heroCard: {
      padding: SPACING.lg,
      borderRadius: RADIUS.xl,
      overflow: 'hidden',
    },
    heroLabel: {
      ...TYPOGRAPHY.bodyMedium,
      color: 'rgba(255,255,255,0.85)',
      fontWeight: '500',
    },
    heroAmount: {
      fontSize: 34,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -1,
      marginTop: 4,
    },
    heroBlur: {
      position: 'absolute',
      right: -20,
      bottom: -20,
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: 'rgba(255,255,255,0.1)',
    },

    // Stats
    statsRow: {
      flexDirection: 'row',
      marginBottom: SPACING.md,
    },
    statTile: {
      flex: 1,
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
    },
    statLabel: {
      ...TYPOGRAPHY.caption,
      fontWeight: '600',
    },
    statAmount: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      fontWeight: '800',
      marginTop: 4,
    },

    // Savings
    savingsCard: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.md,
    },
    savingsLabel: {
      ...TYPOGRAPHY.label,
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    savingsAmount: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      fontWeight: '800',
      marginTop: 2,
    },
    avatarGroup: { flexDirection: 'row', alignItems: 'center' },
    avatarCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.bgCard,
    },

    // Sections
    sectionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.sm,
      marginTop: SPACING.sm,
    },
    sectionTitle: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    sectionAction: {
      ...TYPOGRAPHY.caption,
      color: colors.primary,
      fontWeight: '700',
    },

    // Donut chart card
    donutCard: {
      alignItems: 'center',
      paddingVertical: SPACING.lg,
    },
    legendGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: SPACING.md,
      gap: SPACING.md,
      width: '100%',
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      width: '45%',
    },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      fontWeight: '500',
    },

    // Recent Transactions
    txList: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: SPACING.md,
    },
  });
