import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, formatCurrency, formatCompact } from '../../utils/constants';
import { TransactionService } from '../../services/transactionService';
import { AccountService, BudgetService, NetWorthService } from '../../services/dataServices';
import { useAppStore } from '../../store/appStore';
import { Card, SectionHeader, StatCard, ProgressBar, EmptyState, FAB } from '../../components/common';
import TransactionItem from '../../components/TransactionItem';
import { Transaction, Budget } from '../../utils/types';
import { format } from 'date-fns';

export default function DashboardScreen() {
  const router = useRouter();
  const { dashboardStats, setDashboardStats, recentTransactions, setRecentTransactions,
          accounts, setAccounts, budgets, setBudgets } = useAppStore();
  const [refreshing, setRefreshing] = useState(false);
  const [netWorth, setNetWorth] = useState({ assets: 0, liabilities: 0, netWorth: 0 });

  const loadData = useCallback(async () => {
    const now = new Date();
    const [txs, accs, budgetData, nw, monthStats] = await Promise.all([
      TransactionService.getAll(undefined, 10),
      AccountService.getAll(),
      BudgetService.getForMonth(now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0')),
      NetWorthService.getNetWorth(),
      TransactionService.getMonthlyStats(now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0')),
    ]);

    setRecentTransactions(txs);
    setAccounts(accs);
    setBudgets(budgetData);
    setNetWorth(nw);

    const totalBalance = accs.reduce((sum, a) => sum + a.balance, 0);
    const savingsRate = monthStats.income > 0
      ? ((monthStats.income - monthStats.expense) / monthStats.income) * 100
      : 0;

    setDashboardStats({
      totalBalance,
      totalIncome: monthStats.income,
      totalExpenses: monthStats.expense,
      savingsRate,
      netWorth: nw.netWorth,
    });
  }, []);

  useEffect(() => { loadData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.scroll}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()} 👋</Text>
            <Text style={styles.month}>{format(new Date(), 'MMMM yyyy')}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Net Worth Hero Card */}
        <View style={styles.heroCard}>
          <LinearGradientView>
            <Text style={styles.heroLabel}>TOTAL NET WORTH</Text>
            <Text style={styles.heroAmount}>{formatCurrency(netWorth.netWorth)}</Text>
            <View style={styles.heroRow}>
              <View style={styles.heroStat}>
                <Ionicons name="arrow-up-circle" size={16} color={COLORS.income} />
                <Text style={styles.heroStatLabel}>Assets</Text>
                <Text style={[styles.heroStatValue, { color: COLORS.income }]}>{formatCompact(netWorth.assets)}</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Ionicons name="arrow-down-circle" size={16} color={COLORS.expense} />
                <Text style={styles.heroStatLabel}>Liabilities</Text>
                <Text style={[styles.heroStatValue, { color: COLORS.expense }]}>{formatCompact(netWorth.liabilities)}</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Ionicons name="wallet" size={16} color={COLORS.primary} />
                <Text style={styles.heroStatLabel}>Balance</Text>
                <Text style={[styles.heroStatValue, { color: COLORS.primary }]}>{formatCompact(dashboardStats.totalBalance)}</Text>
              </View>
            </View>
          </LinearGradientView>
        </View>

        {/* Month Stats */}
        <View style={styles.statsRow}>
          <StatCard
            title="Income"
            amount={dashboardStats.totalIncome}
            type="income"
            icon="trending-up"
          />
          <View style={{ width: SPACING.sm }} />
          <StatCard
            title="Expenses"
            amount={dashboardStats.totalExpenses}
            type="expense"
            icon="trending-down"
          />
        </View>

        {/* Savings Rate */}
        <Card style={styles.savingsCard}>
          <View style={styles.savingsHeader}>
            <Text style={styles.savingsTitle}>Savings Rate</Text>
            <Text style={[styles.savingsPercent, {
              color: dashboardStats.savingsRate >= 20 ? COLORS.income
                : dashboardStats.savingsRate >= 10 ? COLORS.warning : COLORS.expense
            }]}>
              {dashboardStats.savingsRate.toFixed(1)}%
            </Text>
          </View>
          <ProgressBar
            progress={Math.max(0, dashboardStats.savingsRate) / 100}
            color={dashboardStats.savingsRate >= 20 ? COLORS.income : dashboardStats.savingsRate >= 10 ? COLORS.warning : COLORS.expense}
            height={8}
          />
          <Text style={styles.savingsHint}>
            {dashboardStats.savingsRate >= 20 ? '🎉 Excellent! Keep it up!'
              : dashboardStats.savingsRate >= 10 ? '✅ Good, try to save more'
              : '⚠️ Low savings this month'}
          </Text>
        </Card>

        {/* Accounts */}
        <SectionHeader title="Accounts" action="View all" onAction={() => router.push('/accounts')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountsScroll}>
          {accounts.map(account => (
            <TouchableOpacity key={account.id} style={[styles.accountCard, { borderColor: account.color + '40' }]}
              onPress={() => router.push('/accounts')}>
              <View style={[styles.accountIcon, { backgroundColor: account.color + '20' }]}>
                <Ionicons name={account.icon as any} size={20} color={account.color} />
              </View>
              <Text style={styles.accountName} numberOfLines={1}>{account.name}</Text>
              <Text style={[styles.accountBalance, { color: account.balance >= 0 ? COLORS.textPrimary : COLORS.expense }]}>
                {formatCompact(account.balance)}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.addAccountCard} onPress={() => router.push('/accounts/add')}>
            <Ionicons name="add" size={24} color={COLORS.primary} />
            <Text style={styles.addAccountText}>Add Account</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Budget Overview */}
        {budgets.length > 0 && (
          <>
            <SectionHeader title="Budgets" action="View all" onAction={() => router.push('/budgets')} />
            {budgets.slice(0, 3).map(budget => (
              <BudgetRow key={budget.id} budget={budget} />
            ))}
          </>
        )}

        {/* Recent Transactions */}
        <SectionHeader title="Recent Transactions" action="View all" onAction={() => router.push('/transactions')} />
        {recentTransactions.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="No transactions yet"
            subtitle="Tap + to add your first transaction"
          />
        ) : (
          <Card style={styles.txCard}>
            {recentTransactions.map((tx, idx) => (
              <View key={tx.id}>
                <TransactionItem item={tx} onPress={() => router.push(`/transactions/${tx.id}`)} />
                {idx < recentTransactions.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </Card>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <FAB onPress={() => router.push('/transactions/add')} />
    </SafeAreaView>
  );
}

// Inline gradient-style card using borderColor trick
const LinearGradientView: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.gradientCard}>{children}</View>
);

const BudgetRow: React.FC<{ budget: Budget }> = ({ budget }) => {
  const progress = budget.limit_amount > 0 ? budget.spent / budget.limit_amount : 0;
  return (
    <Card style={styles.budgetRow}>
      <View style={styles.budgetHeader}>
        <View style={styles.budgetLeft}>
          <View style={[styles.budgetDot, { backgroundColor: budget.categoryColor || COLORS.primary }]} />
          <Text style={styles.budgetName}>{budget.categoryName}</Text>
        </View>
        <Text style={styles.budgetAmount}>
          <Text style={{ color: progress > 0.9 ? COLORS.expense : COLORS.textPrimary }}>
            {formatCurrency(budget.spent)}
          </Text>
          <Text style={{ color: COLORS.textMuted }}> / {formatCurrency(budget.limit_amount)}</Text>
        </Text>
      </View>
      <ProgressBar progress={progress} height={5} style={{ marginTop: 8 }} />
    </Card>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  greeting: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary },
  month: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 2 },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heroCard: {
    marginBottom: SPACING.md,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  gradientCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  heroLabel: {
    ...TYPOGRAPHY.label,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
    marginBottom: SPACING.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  heroStatLabel: {
    ...TYPOGRAPHY.caption,
    color: 'rgba(255,255,255,0.6)',
  },
  heroStatValue: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '700',
    color: '#fff',
  },
  heroDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  savingsCard: {
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  savingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  savingsTitle: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  savingsPercent: {
    ...TYPOGRAPHY.h3,
    fontWeight: '800',
  },
  savingsHint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  accountsScroll: {
    marginHorizontal: -SPACING.md,
    paddingLeft: SPACING.md,
    marginBottom: SPACING.md,
  },
  accountCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginRight: SPACING.sm,
    width: 120,
    borderWidth: 1,
    gap: 6,
  },
  accountIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountName: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  accountBalance: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '700',
  },
  addAccountCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginRight: SPACING.md,
    width: 90,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addAccountText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    textAlign: 'center',
  },
  budgetRow: {
    marginBottom: SPACING.sm,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  budgetDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  budgetName: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
  },
  budgetAmount: {
    ...TYPOGRAPHY.caption,
  },
  txCard: {
    padding: 0,
    marginBottom: SPACING.sm,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
  },
});
