import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import {
  Card,
  EmptyState,
  ProgressBar,
  SectionHeader,
} from '../../components/common';
import TransactionItem from '../../components/TransactionItem';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import {
  AccountService,
  BudgetService,
  NetWorthService,
} from '../../services/dataServices';
import { triggerBackgroundSync } from '../../services/syncService';
import { TransactionService } from '../../services/transactionService';
import { useAppStore } from '../../store/appStore';
import {
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  formatCompact,
  formatCurrency,
} from '../../utils/constants';
import type { Budget } from '../../utils/types';

// ─── AnimatedCircle ────────────────────────────────────────────────────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Donut Chart Component ────────────────────────────────────────────────────
interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

const DonutSliceAnimated: React.FC<{
  cx: number;
  cy: number;
  r: number;
  strokeWidth: number;
  color: string;
  dashArray: number;
  circumference: number;
  dashOffset: number;
}> = ({
  cx,
  cy,
  r,
  strokeWidth,
  color,
  dashArray,
  circumference,
  dashOffset,
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: `${dashArray * progress.value} ${circumference - dashArray * progress.value}`,
    strokeDashoffset: dashOffset,
  }));

  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={r}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      animatedProps={animatedProps}
      strokeLinecap="round"
    />
  );
};

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
            <DonutSliceAnimated
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth={strokeWidth}
              color={slice.color}
              dashArray={dashArray}
              circumference={circumference}
              dashOffset={dashOffset}
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
  const isOver = pct >= 100;

  return (
    <View
      style={{
        backgroundColor: (isOver ? colors.expense : colors.warning) + '10',
        borderLeftWidth: 4,
        borderLeftColor: isOver ? colors.expense : colors.warning,
        borderRadius: RADIUS.sm,
        padding: SPACING.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: SPACING.sm,
      }}
    >
      <Ionicons
        name="warning"
        size={22}
        color={isOver ? colors.expense : colors.warning}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            ...TYPOGRAPHY.bodyMedium,
            color: isOver ? colors.expense : colors.warning,
            fontWeight: '700',
          }}
        >
          {isOver ? 'Over Budget!' : 'Budget Alert'}
        </Text>
        <Text
          style={{
            ...TYPOGRAPHY.caption,
            color: colors.textSecondary,
            marginTop: 2,
          }}
        >
          {budget.categoryName ?? 'Category'} — {pct}% used.
          {!isOver && ` ${formatCurrency(remaining)} left.`}
        </Text>
      </View>
      <View
        style={{
          width: 64,
          height: 6,
          backgroundColor: (isOver ? colors.expense : colors.warning) + '30',
          borderRadius: RADIUS.full,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: isOver ? colors.expense : colors.warning,
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
  const dashboardStats = useAppStore((s) => s.dashboardStats);
  const setDashboardStats = useAppStore((s) => s.setDashboardStats);
  const recentTransactions = useAppStore((s) => s.recentTransactions);
  const setRecentTransactions = useAppStore((s) => s.setRecentTransactions);
  const setAccounts = useAppStore((s) => s.setAccounts);
  const budgets = useAppStore((s) => s.budgets);
  const setBudgets = useAppStore((s) => s.setBudgets);
  const dataRevision = useAppStore((s) => s.dataRevision);
  const userProfile = useAppStore((s) => s.userProfile);
  const syncInProgress = useAppStore((s) => s.syncInProgress);
  const [refreshing, setRefreshing] = useState(false);
  const [spendingSlices, setSpendingSlices] = useState<DonutSlice[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);

  const CHART_COLORS = colors.chart;

  const loadData = useCallback(async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    const [txs, accs, budgetData, nw, monthStats] = await Promise.all([
      TransactionService.getAll(undefined, 10),
      AccountService.getAll(),
      BudgetService.getForMonth(year, month),
      NetWorthService.getNetWorth(),
      TransactionService.getMonthlyStats(year, month),
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

    // Build spending distribution using SQL-backed category breakdown
    const dateFrom = `${year}-${month}-01`;
    const lastDay = new Date(year, Number(month), 0).getDate();
    const dateTo = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    const categoryBreakdown =
      await TransactionService.getCategoryBreakdownByDateRange(
        dateFrom,
        dateTo,
        'expense',
      );
    const slices: DonutSlice[] = categoryBreakdown
      .slice(0, 4)
      .map((entry, i) => ({
        label: entry.categoryName ?? 'Other',
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
    await triggerBackgroundSync('pull-to-refresh');
    await loadData();
    setRefreshing(false);
  };

  // All over-70% budget alerts
  const alertBudgets = budgets.filter(
    (b) => b.limit_amount > 0 && b.spent / b.limit_amount >= 0.7,
  );

  const savingsAmount =
    dashboardStats.totalIncome - dashboardStats.totalExpenses;
  const savingsProgress =
    dashboardStats.totalIncome > 0
      ? Math.max(0, Math.min(1, savingsAmount / dashboardStats.totalIncome))
      : 0;
  const displayName = userProfile?.name ?? 'there';

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
              <Text style={styles.welcomeText}>Welcome, {displayName}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {syncInProgress && (
              <ActivityIndicator size="small" color={colors.primary} />
            )}
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
          </View>
        </Animated.View>

        {/* Hero Card — Net Balance + Income + Expense */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(100)}
          style={styles.heroWrapper}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push('/accounts' as Href)}
          >
            <LinearGradient
              colors={['#8B5CF6', '#6D28D9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              {/* Decorative blobs */}
              <View style={styles.heroBlob1} />
              <View style={styles.heroBlob2} />

              <Text style={styles.heroLabel}>Net Balance</Text>
              <Text style={styles.heroAmount}>
                {formatCurrency(dashboardStats.totalBalance)}
              </Text>

              <View style={styles.heroStatsRow}>
                <View style={styles.heroStatItem}>
                  <View style={styles.heroStatIcon}>
                    <Ionicons name="arrow-down" size={12} color="#10B981" />
                  </View>
                  <View>
                    <Text style={styles.heroStatLabel}>Income</Text>
                    <Text style={styles.heroStatValue}>
                      {formatCompact(dashboardStats.totalIncome)}
                    </Text>
                  </View>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <View
                    style={[
                      styles.heroStatIcon,
                      { backgroundColor: 'rgba(244,63,94,0.2)' },
                    ]}
                  >
                    <Ionicons name="arrow-up" size={12} color="#F43F5E" />
                  </View>
                  <View>
                    <Text style={styles.heroStatLabel}>Expense</Text>
                    <Text style={styles.heroStatValue}>
                      {formatCompact(dashboardStats.totalExpenses)}
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Savings Progress Card */}
        <Animated.View entering={FadeInDown.duration(500).delay(200)}>
          <TouchableOpacity
            style={styles.savingsCard}
            activeOpacity={0.8}
            onPress={() => router.push('/reports')}
          >
            <View style={styles.savingsHeader}>
              <Text style={styles.savingsLabel}>MONTHLY SAVINGS</Text>
              <Text style={styles.savingsRate}>
                {dashboardStats.savingsRate.toFixed(1)}%
              </Text>
            </View>
            <Text style={styles.savingsAmount}>
              {formatCurrency(savingsAmount)}
            </Text>
            <ProgressBar
              progress={savingsProgress}
              color={savingsAmount >= 0 ? colors.income : colors.expense}
            />
            <Text style={styles.savingsSub}>
              of {formatCurrency(dashboardStats.totalIncome)} income
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Budget Alerts */}
        {alertBudgets.length > 0 && (
          <Animated.View entering={FadeInDown.duration(500).delay(300)}>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/budgets')}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>Budget Alerts</Text>
              {alertBudgets.map((b) => (
                <BudgetAlertCard key={b.id} budget={b} colors={colors} />
              ))}
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Quick Actions */}
        <Animated.View entering={FadeInDown.duration(500).delay(320)}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => router.push('/splits' as Href)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.quickActionIcon,
                  { backgroundColor: colors.primary + '18' },
                ]}
              >
                <Ionicons
                  name="people-outline"
                  size={22}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.quickActionLabel}>Split{'\n'}Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => router.push('/sms-import')}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.quickActionIcon,
                  { backgroundColor: colors.income + '18' },
                ]}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={22}
                  color={colors.income}
                />
              </View>
              <Text style={styles.quickActionLabel}>SMS{'\n'}Import</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => router.push('/reports')}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.quickActionIcon,
                  { backgroundColor: colors.warning + '18' },
                ]}
              >
                <Ionicons
                  name="bar-chart-outline"
                  size={22}
                  color={colors.warning}
                />
              </View>
              <Text style={styles.quickActionLabel}>Reports</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => router.push('/(tabs)/goals')}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.quickActionIcon,
                  { backgroundColor: colors.expense + '18' },
                ]}
              >
                <Ionicons
                  name="flag-outline"
                  size={22}
                  color={colors.expense}
                />
              </View>
              <Text style={styles.quickActionLabel}>Goals</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Spending Distribution */}
        <Animated.View entering={FadeInDown.duration(500).delay(350)}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Spending Distribution</Text>
            <TouchableOpacity onPress={() => router.push('/reports')}>
              <Text style={styles.sectionAction}>Details</Text>
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
                <Animated.View
                  key={tx.id}
                  entering={FadeInDown.duration(400).delay(420 + idx * 60)}
                >
                  <TransactionItem
                    item={tx}
                    onPress={() => router.push(`/transactions/${tx.id}`)}
                  />
                  {idx < Math.min(recentTransactions.length, 5) - 1 && (
                    <View style={styles.divider} />
                  )}
                </Animated.View>
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
const createStyles = (colors: ThemeColors) =>
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
      shadowColor: 'rgba(139,92,246,0.15)',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 1,
      shadowRadius: 24,
      elevation: 8,
    },
    heroCard: {
      padding: SPACING.lg,
      borderRadius: RADIUS.xl,
      overflow: 'hidden',
    },
    heroBlob1: {
      position: 'absolute',
      right: -30,
      top: -30,
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    heroBlob2: {
      position: 'absolute',
      left: -20,
      bottom: -20,
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    heroLabel: {
      ...TYPOGRAPHY.bodyMedium,
      color: 'rgba(255,255,255,0.75)',
      fontWeight: '500',
    },
    heroAmount: {
      fontSize: 38,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -1.5,
      marginTop: 4,
      marginBottom: SPACING.lg,
    },
    heroStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.15)',
      borderRadius: RADIUS.md,
      padding: SPACING.md,
    },
    heroStatItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    heroStatIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(16,185,129,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroStatLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.65)',
    },
    heroStatValue: {
      fontSize: 16,
      fontWeight: '800',
      color: '#fff',
      marginTop: 1,
    },
    heroStatDivider: {
      width: 1,
      height: 36,
      backgroundColor: 'rgba(255,255,255,0.2)',
      marginHorizontal: SPACING.sm,
    },

    // Savings
    savingsCard: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: SPACING.md,
    },
    savingsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    savingsLabel: {
      ...TYPOGRAPHY.label,
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    savingsRate: {
      ...TYPOGRAPHY.caption,
      color: colors.income,
      fontWeight: '700',
    },
    savingsAmount: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      fontWeight: '800',
      marginBottom: SPACING.sm,
    },
    savingsSub: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      marginTop: 6,
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
      marginBottom: SPACING.sm,
    },
    sectionAction: {
      ...TYPOGRAPHY.caption,
      color: colors.primary,
      fontWeight: '700',
    },

    // Quick Actions
    quickActionsRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginBottom: SPACING.lg,
    },
    quickActionCard: {
      flex: 1,
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    quickActionIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickActionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      textAlign: 'center',
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
