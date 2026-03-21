import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, FAB } from '../../components/common';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { SplitService } from '../../services/splitService';
import { useAppStore } from '../../store/appStore';
import { RADIUS, SPACING, TYPOGRAPHY, formatCurrency } from '../../utils/constants';
import type { SplitExpense, SplitMember } from '../../utils/types';

interface SplitItem {
  expense: SplitExpense;
  members: SplitMember[];
  transactionMerchant?: string;
  transactionDate?: string;
}

export default function SplitListScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dataRevision = useAppStore((s) => s.dataRevision);

  const [splits, setSplits] = useState<SplitItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadSplits = useCallback(async () => {
    const data = await SplitService.getAll();
    setSplits(data);
  }, []);

  useEffect(() => {
    void loadSplits();
  }, [loadSplits, dataRevision]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSplits();
    setRefreshing(false);
  };

  const totalOwed = splits.reduce((sum, s) => {
    const pending = s.members
      .filter((m) => m.status === 'pending')
      .reduce((a, m) => a + m.shareAmount, 0);
    return sum + pending;
  }, 0);

  const totalCollected = splits.reduce((sum, s) => {
    const paid = s.members
      .filter((m) => m.status === 'paid')
      .reduce((a, m) => a + m.shareAmount, 0);
    return sum + paid;
  }, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Split Expenses</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Summary Cards */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderColor: colors.warning + '30' }]}>
            <Text style={[styles.summaryLabel, { color: colors.warning }]}>Pending</Text>
            <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
              {formatCurrency(totalOwed)}
            </Text>
            <Text style={styles.summaryCount}>
              {splits.filter((s) => s.members.some((m) => m.status === 'pending')).length} splits
            </Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: colors.income + '30' }]}>
            <Text style={[styles.summaryLabel, { color: colors.income }]}>Collected</Text>
            <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
              {formatCurrency(totalCollected)}
            </Text>
            <Text style={styles.summaryCount}>
              {splits.filter((s) => s.members.every((m) => m.status === 'paid')).length} settled
            </Text>
          </View>
        </Animated.View>

        {/* Split List */}
        {splits.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No splits yet"
            subtitle="Split an expense with friends by tapping the + button"
          />
        ) : (
          splits.map((item, idx) => (
            <SplitCard
              key={item.expense.id}
              item={item}
              colors={colors}
              styles={styles}
              delay={idx * 60}
              onPress={() => router.push(`/split-expense/${item.expense.id}`)}
            />
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <FAB onPress={() => router.push('/split-expense/new')} />
    </SafeAreaView>
  );
}

// ─── Split Card ───────────────────────────────────────────────────────────────
const SplitCard: React.FC<{
  item: SplitItem;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  delay: number;
  onPress: () => void;
}> = ({ item, colors, styles, delay, onPress }) => {
  const { expense, members, transactionMerchant, transactionDate } = item;
  const pendingCount = members.filter((m) => m.status === 'pending').length;
  const paidCount = members.filter((m) => m.status === 'paid').length;
  const totalMembers = members.length;
  const pendingAmount = members
    .filter((m) => m.status === 'pending')
    .reduce((sum, m) => sum + m.shareAmount, 0);

  const isSettled = pendingCount === 0 && paidCount > 0;

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(100 + delay)}>
      <TouchableOpacity style={styles.splitCard} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.splitCardHeader}>
          <View
            style={[
              styles.splitIcon,
              {
                backgroundColor: isSettled ? colors.income + '15' : colors.primary + '15',
              },
            ]}
          >
            <Ionicons
              name={isSettled ? 'checkmark-circle' : 'people'}
              size={22}
              color={isSettled ? colors.income : colors.primary}
            />
          </View>
          <View style={styles.splitInfo}>
            <Text style={styles.splitName}>
              {transactionMerchant || expense.notes || 'Untitled Split'}
            </Text>
            <Text style={styles.splitDate}>
              {transactionDate
                ? new Date(transactionDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : new Date(expense.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
            </Text>
          </View>
          <View style={styles.splitAmountCol}>
            <Text style={styles.splitTotalAmount}>{formatCurrency(expense.totalAmount)}</Text>
            <Text
              style={[
                styles.splitStatus,
                {
                  color: isSettled ? colors.income : colors.warning,
                },
              ]}
            >
              {isSettled ? 'Settled' : `${pendingCount} pending`}
            </Text>
          </View>
        </View>

        {/* Members avatars row */}
        <View style={styles.splitMembersRow}>
          <View style={styles.avatarStack}>
            {members.slice(0, 4).map((m, i) => (
              <View
                key={m.id}
                style={[
                  styles.miniAvatar,
                  {
                    marginLeft: i > 0 ? -8 : 0,
                    backgroundColor:
                      m.status === 'paid' ? colors.income + '30' : colors.primary + '30',
                    borderColor: colors.bgCard,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.miniAvatarText,
                    {
                      color: m.status === 'paid' ? colors.income : colors.primary,
                    },
                  ]}
                >
                  {m?.name?.charAt(0)?.toUpperCase()}
                </Text>
              </View>
            ))}
            {members.length > 4 && (
              <View
                style={[
                  styles.miniAvatar,
                  {
                    marginLeft: -8,
                    backgroundColor: colors.bgElevated,
                    borderColor: colors.bgCard,
                  },
                ]}
              >
                <Text style={[styles.miniAvatarText, { color: colors.textMuted }]}>
                  +{members.length - 4}
                </Text>
              </View>
            )}
          </View>
          {!isSettled && (
            <Text style={styles.splitPendingAmount}>{formatCurrency(pendingAmount)} pending</Text>
          )}
        </View>

        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: totalMembers > 0 ? `${(paidCount / totalMembers) * 100}%` : '0%',
                backgroundColor: colors.income,
              },
            ]}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: { padding: 4 },
    title: { ...TYPOGRAPHY.h3, color: colors.textPrimary, fontWeight: '700' },
    scroll: { padding: SPACING.md },

    // Summary
    summaryRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginBottom: SPACING.lg,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
    },
    summaryLabel: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    summaryValue: {
      fontSize: 20,
      fontWeight: '800',
      marginTop: 4,
    },
    summaryCount: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      marginTop: 2,
    },

    // Split card
    splitCard: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: SPACING.sm,
    },
    splitCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    splitIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    splitInfo: { flex: 1 },
    splitName: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    splitDate: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      marginTop: 2,
    },
    splitAmountCol: { alignItems: 'flex-end' },
    splitTotalAmount: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    splitStatus: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
    },

    // Members row
    splitMembersRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    avatarStack: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    miniAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
    },
    miniAvatarText: {
      fontSize: 10,
      fontWeight: '800',
    },
    splitPendingAmount: {
      ...TYPOGRAPHY.caption,
      color: colors.warning,
      fontWeight: '600',
    },

    // Progress
    progressBar: {
      height: 4,
      backgroundColor: colors.bgElevated,
      borderRadius: 2,
      marginTop: 10,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 2,
    },
  });
}
