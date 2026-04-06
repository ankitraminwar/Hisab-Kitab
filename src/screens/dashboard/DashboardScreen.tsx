import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
  FadeInRight,
  FadeOutUp,
  useSharedValue,
  withTiming,
  withRepeat,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Card,
  EmptyState,
  ProgressBar,
  SectionHeader,
  InsightCard,
  SkeletonTransactionList,
} from '../../components/common';
import { showToast } from '../../components/common/Toast';
import { DonutChart as DonutChartNew } from '../../components/charts/DonutChart';
import TransactionItem from '../../components/TransactionItem';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import {
  AccountService,
  BudgetService,
  CategoryService,
  NetWorthService,
} from '../../services/dataServices';
import { triggerBackgroundSync } from '../../services/syncService';
import { TransactionService } from '../../services/transactionService';
import { useAppStore } from '../../store/appStore';
import { RADIUS, SPACING, TYPOGRAPHY, formatCompact, formatCurrency } from '../../utils/constants';
import type { Budget, CategoryBreakdown, SpendingInsight } from '../../utils/types';

const GREETINGS = [
  'Namaste 🇮🇳',
  'Hello 🇺🇸',
  'Howdy 🤠',
  'Hola 🇪🇸',
  'Bonjour 🇫🇷',
  'Ciao 🇮🇹',
  'Vanakkam 🙏',
  'Namaskaram 🙏',
  'Konnichiwa 🇯🇵',
  'Annyeong 🇰🇷',
  'Ni Hao 🇨🇳',
  'Welcome Back',
  'Good to see you',
  'Let’s get started',
  'Ready to go?',
];

// ─── Budget Alert Card ────────────────────────────────────────────────────────
const BudgetAlertCard: React.FC<{
  budget: Budget;
  colors: ReturnType<typeof useTheme>['colors'];
  isBalanceHidden: boolean;
}> = ({ budget, colors, isBalanceHidden }) => {
  const progress = budget.limitAmount > 0 ? budget.spent / budget.limitAmount : 0;
  const remaining = Math.max(0, budget.limitAmount - budget.spent);
  const pct = Math.round(progress * 100);
  const isOver = pct >= 100;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={{
        backgroundColor: (isOver ? colors.expense : colors.warning) + '15',
        borderLeftWidth: 4,
        borderLeftColor: isOver ? colors.expense : colors.warning,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: SPACING.sm,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: (isOver ? colors.expense : colors.warning) + '25',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="warning" size={20} color={isOver ? colors.expense : colors.warning} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            ...TYPOGRAPHY.bodyMedium,
            color: isOver ? colors.expense : colors.warning,
            fontWeight: '800',
          }}
        >
          {isOver ? 'Over Budget!' : 'Budget Warning'}
        </Text>
        <Text style={{ ...TYPOGRAPHY.caption, color: colors.textSecondary, marginTop: 2 }}>
          {budget.categoryName ?? 'Category'} — {pct}% used
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ ...TYPOGRAPHY.bodyMedium, color: colors.textPrimary, fontWeight: '700' }}>
          {isBalanceHidden ? '••••' : formatCurrency(remaining)}
        </Text>
        <Text style={{ ...TYPOGRAPHY.caption, color: colors.textMuted }}>
          {isOver ? 'excess' : 'left'}
        </Text>
      </View>
    </TouchableOpacity>
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
  const unreadNotificationsCount = useAppStore((s) => s.unreadNotificationsCount);
  const setCategories = useAppStore((s) => s.setCategories);

  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryBreakdownData, setCategoryBreakdownData] = useState<CategoryBreakdown[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [insights, setInsights] = useState<SpendingInsight[]>([]);

  const [greetingIndex, setGreetingIndex] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const CHART_COLORS = colors.chart;

  // Animate the greetings every 3 seconds seamlessly
  useEffect(() => {
    const t = setInterval(() => {
      setGreetingIndex((prev) => (prev + 1) % GREETINGS.length);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const blobRotation1 = useSharedValue(0);
  const blobRotation2 = useSharedValue(0);

  useEffect(() => {
    blobRotation1.value = withRepeat(
      withTiming(360, { duration: 15000, easing: Easing.linear }),
      -1,
      false,
    );
    blobRotation2.value = withRepeat(
      withTiming(-360, { duration: 20000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [blobRotation1, blobRotation2]);

  const animatedBlobStyle = useAnimatedStyle(() => {
    return { transform: [{ rotate: `${blobRotation1.value}deg` }, { scale: 1.1 }] };
  });
  const animatedBlobStyle2 = useAnimatedStyle(() => {
    return { transform: [{ rotate: `${blobRotation2.value}deg` }, { scale: 1.2 }] };
  });

  const loadData = useCallback(async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    const [accs, cats, recents, bdgts, monthStats, nw] = await Promise.all([
      AccountService.getAll(),
      CategoryService.getAll(),
      TransactionService.getAll(undefined, 5),
      BudgetService.getForMonth(year, month),
      TransactionService.getMonthlyStats(year, month),
      NetWorthService.getNetWorth(),
    ]);
    setAccounts(accs);
    setCategories(cats);
    setRecentTransactions(recents);
    setBudgets(bdgts);

    const totalBalance = accs.reduce(
      (sum: number, a: { balance: number }) => sum + (Number(a.balance) || 0),
      0,
    );
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

    const dateFrom = `${year}-${month}-01`;
    const lastDay = new Date(year, Number(month), 0).getDate();
    const dateTo = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    const categoryBreakdown = await TransactionService.getCategoryBreakdownByDateRange(
      dateFrom,
      dateTo,
      'expense',
    );
    setTotalSpent(monthStats.expense);

    // Build CategoryBreakdown data for the new DonutChart
    const breakdownData: CategoryBreakdown[] = categoryBreakdown.slice(0, 6).map((entry, i) => ({
      categoryId: entry.categoryId || `cat-${i}`,
      categoryName: entry.categoryName ?? 'Other',
      categoryIcon: 'ellipse',
      categoryColor: CHART_COLORS[i % CHART_COLORS.length],
      percentage: monthStats.expense > 0 ? (entry.total / monthStats.expense) * 100 : 0,
      amount: entry.total,
    }));
    setCategoryBreakdownData(breakdownData);

    // Generate spending insights
    const newInsights: SpendingInsight[] = [];

    // Insight: Top spending category
    if (categoryBreakdown.length > 0) {
      const top = categoryBreakdown[0];
      const topPercent =
        monthStats.expense > 0 ? Math.round((top.total / monthStats.expense) * 100) : 0;
      if (topPercent > 40) {
        newInsights.push({
          id: 'top-category',
          type: 'warning',
          icon: 'pie-chart',
          title: `${top.categoryName} dominates spending`,
          description: `${top.categoryName} accounts for ${topPercent}% of your expenses this month.`,
          color: colors.warning,
        });
      }
    }

    // Insight: Savings rate
    const sRate =
      monthStats.income > 0
        ? ((monthStats.income - monthStats.expense) / monthStats.income) * 100
        : 0;
    if (sRate > 30) {
      newInsights.push({
        id: 'good-savings',
        type: 'achievement',
        icon: 'trophy',
        title: 'Great savings rate!',
        description: `You're saving ${sRate.toFixed(0)}% of your income. Keep it up!`,
        color: colors.income,
      });
    } else if (sRate < 10 && monthStats.income > 0) {
      newInsights.push({
        id: 'low-savings',
        type: 'tip',
        icon: 'bulb',
        title: 'Savings opportunity',
        description: `You can save ${formatCurrency(Math.max(0, monthStats.income * 0.2 - (monthStats.income - monthStats.expense)))} more by cutting discretionary spending.`,
        color: colors.primary,
      });
    }

    // Insight: Budget alerts count
    const overBudgets = bdgts.filter((b) => b.limitAmount > 0 && b.spent / b.limitAmount >= 0.9);
    if (overBudgets.length > 0) {
      newInsights.push({
        id: 'budget-alert',
        type: 'warning',
        icon: 'alert-circle',
        title: `${overBudgets.length} budget${overBudgets.length > 1 ? 's' : ''} near limit`,
        description: 'Review your budgets to avoid overspending this month.',
        color: colors.expense,
      });
    }

    setInsights(newInsights.slice(0, 3));
    setIsLoading(false);
  }, [
    CHART_COLORS,
    colors.expense,
    colors.income,
    colors.primary,
    colors.warning,
    setAccounts,
    setCategories,
    setBudgets,
    setDashboardStats,
    setRecentTransactions,
  ]);

  useEffect(() => {
    void loadData();
  }, [dataRevision, loadData]);

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await triggerBackgroundSync('pull-to-refresh');
    await loadData();
    setRefreshing(false);
    showToast.success('Dashboard refreshed');
  };

  const toggleHideBalance = () => {
    Haptics.selectionAsync();
    setIsBalanceHidden(!isBalanceHidden);
  };

  const handleQuickScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const isEndReached = contentOffset.x + layoutMeasurement.width >= contentSize.width - 20;
    const isStartReached = contentOffset.x <= 10;

    setCanScrollLeft(!isStartReached);
    setCanScrollRight(!isEndReached);
  };

  const alertBudgets = budgets.filter((b) => b.limitAmount > 0 && b.spent / b.limitAmount >= 0.7);
  const savingsAmount = dashboardStats.totalIncome - dashboardStats.totalExpenses;
  const savingsProgress =
    dashboardStats.totalIncome > 0
      ? Math.max(0, Math.min(1, savingsAmount / dashboardStats.totalIncome))
      : 0;
  const displayName = userProfile?.name ?? 'there';

  const formatSecured = (val: number, isCompact = false) => {
    if (isBalanceHidden) return '••••••';
    return isCompact ? formatCompact(val) : formatCurrency(val);
  };

  const QUICKS = [
    {
      id: 'notes',
      title: 'Notes',
      icon: 'document-text' as const,
      color: '#3B82F6',
      path: '/notes',
    },
    { id: 'splits', title: 'Splits', icon: 'people' as const, color: '#8B5CF6', path: '/splits' },
    {
      id: 'reports',
      title: 'Reports',
      icon: 'pie-chart' as const,
      color: '#F59E0B',
      path: '/reports',
    },
    { id: 'goals', title: 'Goals', icon: 'flag' as const, color: '#F43F5E', path: '/(tabs)/goals' },
  ];

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
        {/* Header Section */}
        <Animated.View entering={FadeInDown.duration(400)} style={[styles.header, { flex: 1 }]}>
          <View style={[styles.headerLeft, { flex: 1 }]}>
            <View style={styles.avatarWrap}>
              <Ionicons name="wallet" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, paddingRight: 10 }}>
              {/* Animated Greeting Container */}
              <View style={{ height: 20 }}>
                <Animated.Text
                  key={GREETINGS[greetingIndex]}
                  entering={FadeInDown.duration(800)}
                  exiting={FadeOutUp.duration(800)}
                  style={[styles.welcomeText, { position: 'absolute' }]}
                >
                  {GREETINGS[greetingIndex]}
                </Animated.Text>
              </View>
              <Text style={styles.appName} numberOfLines={1}>
                {displayName}
              </Text>
            </View>
          </View>
          <View style={[styles.headerActions, { flexShrink: 0 }]}>
            {syncInProgress && (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
            )}
            <TouchableOpacity
              onPress={toggleHideBalance}
              style={styles.iconBtn}
              accessibilityLabel={isBalanceHidden ? 'Show balance' : 'Hide balance'}
              accessibilityRole="button"
            >
              <Ionicons
                name={isBalanceHidden ? 'eye-off' : 'eye'}
                size={22}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              style={styles.iconBtn}
              accessibilityLabel="Notifications"
              accessibilityRole="button"
            >
              <Ionicons name="notifications" size={22} color={colors.textSecondary} />
              {unreadNotificationsCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    backgroundColor: colors.expense,
                    borderRadius: 8,
                    minWidth: 16,
                    height: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                    borderWidth: 2,
                    borderColor: colors.bg,
                  }}
                >
                  <Text style={{ color: colors.textInverse, fontSize: 8, fontWeight: '800' }}>
                    {unreadNotificationsCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Hero Card */}
        <Animated.View entering={FadeInDown.duration(500).delay(100)}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/accounts' as Href)}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              {/* Complex Glassy Blobs */}
              <Animated.View
                style={[
                  styles.heroBlob,
                  { right: -40, top: -40, width: 160, height: 160, borderRadius: 80 },
                  animatedBlobStyle,
                ]}
              />
              <Animated.View
                style={[
                  styles.heroBlob,
                  { left: -30, bottom: -40, width: 120, height: 120, borderRadius: 60 },
                  animatedBlobStyle2,
                ]}
              />

              <Text style={styles.heroLabel}>Total Net Balance</Text>
              <Text style={styles.heroAmount}>{formatSecured(dashboardStats.totalBalance)}</Text>

              <View style={styles.heroStatsContainer}>
                <View style={styles.heroStatItem}>
                  <View style={[styles.heroStatIcon, { backgroundColor: 'rgba(16,185,129,0.25)' }]}>
                    <Ionicons name="arrow-down" size={14} color="#34D399" />
                  </View>
                  <View>
                    <Text style={styles.heroStatLabel}>Income</Text>
                    <Text style={styles.heroStatValue}>
                      {formatSecured(dashboardStats.totalIncome, true)}
                    </Text>
                  </View>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <View style={[styles.heroStatIcon, { backgroundColor: 'rgba(244,63,94,0.25)' }]}>
                    <Ionicons name="arrow-up" size={14} color="#FB7185" />
                  </View>
                  <View>
                    <Text style={styles.heroStatLabel}>Expense</Text>
                    <Text style={styles.heroStatValue}>
                      {formatSecured(dashboardStats.totalExpenses, true)}
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Actionable Insights */}
        {insights.length > 0 && (
          <Animated.View
            entering={FadeInDown.duration(500).delay(150)}
            style={{ marginTop: SPACING.md }}
          >
            <Text style={styles.sectionTitle}>Insights</Text>
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </Animated.View>
        )}

        {/* Quick Actions (Horizontal Scroll) */}
        <Animated.View
          entering={FadeInRight.duration(500).delay(200)}
          style={{ marginVertical: SPACING.sm }}
        >
          <Text style={[styles.sectionTitle, { marginLeft: SPACING.xs }]}>Quick Actions</Text>
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              onScroll={handleQuickScroll}
              scrollEventThrottle={16}
              contentContainerStyle={{
                paddingHorizontal: SPACING.xs,
                paddingBottom: SPACING.md,
                gap: SPACING.md,
              }}
            >
              {QUICKS.map((q) => (
                <TouchableOpacity
                  key={q.id}
                  style={[styles.quickTile, { backgroundColor: colors.bgCard }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(q.path as Href);
                  }}
                  activeOpacity={0.7}
                  accessibilityLabel={`Open ${q.title}`}
                  accessibilityRole="button"
                >
                  <View style={[styles.quickTileIconWrap, { backgroundColor: q.color + '15' }]}>
                    <Ionicons name={q.icon} size={28} color={q.color} />
                  </View>
                  <Text style={styles.quickTileText}>{q.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Scroll Indicators */}
            {canScrollLeft && (
              <View style={[styles.scrollIndicator, { left: 0 }]}>
                <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
              </View>
            )}
            {canScrollRight && (
              <View style={[styles.scrollIndicator, { right: 0 }]}>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </View>
            )}
          </View>
        </Animated.View>

        {/* Savings Card */}
        <Animated.View entering={FadeInDown.duration(500).delay(250)}>
          <Card style={styles.savingsCard} onPress={() => router.push('/reports')}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                marginBottom: 16,
              }}
            >
              <View>
                <Text style={styles.savingsLabel}>MONTHLY SAVINGS</Text>
                <Text style={styles.savingsAmount}>{formatSecured(savingsAmount)}</Text>
              </View>
              <View
                style={[
                  styles.savingsBadge,
                  { backgroundColor: (savingsAmount >= 0 ? colors.income : colors.expense) + '15' },
                ]}
              >
                <Text
                  style={[
                    styles.savingsRate,
                    { color: savingsAmount >= 0 ? colors.income : colors.expense },
                  ]}
                >
                  {dashboardStats.savingsRate.toFixed(1)}%
                </Text>
              </View>
            </View>
            <ProgressBar
              progress={savingsProgress}
              color={savingsAmount >= 0 ? colors.income : colors.expense}
            />
            <Text style={styles.savingsSub}>
              from {formatSecured(dashboardStats.totalIncome)} total income
            </Text>
          </Card>
        </Animated.View>

        {/* Budget Alerts */}
        {alertBudgets.length > 0 && (
          <Animated.View entering={FadeInDown.duration(500).delay(300)}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/budgets')} activeOpacity={0.7}>
              <Text style={styles.sectionTitle}>Budget Alerts</Text>
              {alertBudgets.map((b) => (
                <BudgetAlertCard
                  key={b.id}
                  budget={b}
                  colors={colors}
                  isBalanceHidden={isBalanceHidden}
                />
              ))}
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Spending Distribution */}
        <Animated.View entering={FadeInDown.duration(500).delay(350)}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Spending Distribution</Text>
            <TouchableOpacity onPress={() => router.push('/reports')}>
              <Text style={styles.sectionAction}>View Full Report</Text>
            </TouchableOpacity>
          </View>
          <Card style={styles.donutCard}>
            <DonutChartNew
              data={
                categoryBreakdownData.length > 0
                  ? categoryBreakdownData
                  : [
                      {
                        categoryId: 'none',
                        categoryName: 'No data',
                        categoryIcon: 'ellipse',
                        categoryColor: colors.bgElevated,
                        percentage: 100,
                        amount: 0,
                      },
                    ]
              }
              size={200}
              strokeWidth={22}
              centerLabel="Total Spent"
              centerValue={isBalanceHidden ? '••••' : formatCompact(totalSpent)}
            />
          </Card>
        </Animated.View>

        {/* Recent Transactions */}
        <Animated.View entering={FadeInDown.duration(500).delay(400)}>
          <SectionHeader
            title="Recent Transactions"
            action="See All"
            onAction={() => router.push('/transactions')}
          />
          {isLoading ? (
            <SkeletonTransactionList count={3} />
          ) : recentTransactions.length === 0 ? (
            <EmptyState
              icon="receipt"
              title="No transactions yet"
              subtitle="Tap + to add your first transaction"
            />
          ) : (
            <View style={styles.txList}>
              {recentTransactions.slice(0, 5).map((tx, idx) => (
                <View key={tx.id}>
                  <TransactionItem
                    item={{ ...tx, amount: isBalanceHidden ? 0 : tx.amount }}
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
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },

    // Header
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatarWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    welcomeText: { ...TYPOGRAPHY.caption, color: colors.textMuted },
    appName: { ...TYPOGRAPHY.h3, color: colors.textPrimary, fontWeight: '800' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconBtn: {
      padding: 8,
      minWidth: 44,
      minHeight: 44,
      backgroundColor: colors.bgElevated,
      borderRadius: RADIUS.full,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Hero
    heroCard: {
      padding: SPACING.lg,
      borderRadius: RADIUS.xl,
      overflow: 'hidden',
      elevation: 12,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
    },
    heroBlob: { position: 'absolute', backgroundColor: colors.heroOverlay },
    heroLabel: { ...TYPOGRAPHY.label, color: colors.heroTextMuted, letterSpacing: 1 },
    heroAmount: {
      fontSize: 36,
      fontWeight: '900',
      color: colors.heroText,
      letterSpacing: -1.5,
      marginVertical: SPACING.sm,
    },
    heroStatsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.overlayLight,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      backdropFilter: 'blur(10px)',
    },
    heroStatItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    heroStatIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroStatLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.6)',
      textTransform: 'uppercase',
    },
    heroStatValue: { fontSize: 16, fontWeight: '800', color: colors.heroText, marginTop: 2 },
    heroStatDivider: {
      width: 1,
      height: 40,
      backgroundColor: 'rgba(255,255,255,0.15)',
      marginHorizontal: SPACING.md,
    },

    // Quick Actions
    quickTile: {
      width: 80,
      height: 95,
      borderRadius: RADIUS.lg,
      padding: SPACING.sm,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    quickTileIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    quickTileText: {
      ...TYPOGRAPHY.caption,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    scrollIndicator: {
      position: 'absolute',
      top: 40,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.bgCard,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0.8,
      shadowColor: colors.shadow,
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },

    // Sections
    sectionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    sectionTitle: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      fontWeight: '800',
      marginBottom: SPACING.sm,
    },
    sectionAction: { ...TYPOGRAPHY.bodyMedium, color: colors.primary, fontWeight: '700' },

    // Savings
    savingsCard: {
      padding: SPACING.lg,
      marginBottom: SPACING.md,
      shadowColor: colors.shadow,
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 4,
    },
    savingsLabel: { ...TYPOGRAPHY.label, color: colors.textMuted, marginBottom: 4 },
    savingsAmount: { ...TYPOGRAPHY.h2, color: colors.textPrimary, fontWeight: '800' },
    savingsBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
    savingsRate: { fontWeight: '800', fontSize: 14 },
    savingsSub: { ...TYPOGRAPHY.caption, color: colors.textMuted, marginTop: 8 },

    // Donut chart card
    donutCard: {
      paddingVertical: SPACING.lg,
      paddingHorizontal: SPACING.md,
      marginBottom: SPACING.md,
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 4,
    },
    legendGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: SPACING.lg,
      gap: SPACING.md,
      justifyContent: 'center',
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: '40%' },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { ...TYPOGRAPHY.bodyMedium, color: colors.textSecondary, fontWeight: '600' },

    // Recent Transactions
    txList: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      overflow: 'hidden',
      shadowOpacity: 0.03,
      shadowRadius: 10,
      elevation: 2,
    },
    divider: { height: 1, backgroundColor: colors.borderLight, marginHorizontal: SPACING.lg },
  });
