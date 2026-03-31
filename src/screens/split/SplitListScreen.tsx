import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, FAB } from '../../components/common';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { SplitService } from '../../services/splitService';
import { useAppStore } from '../../store/appStore';
import { RADIUS, SPACING, TYPOGRAPHY, formatCurrency } from '../../utils/constants';
import type { SplitExpense, SplitFriend, SplitMember } from '../../utils/types';

const SCREEN_WIDTH = Dimensions.get('window').width;

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
  const [friendBalances, setFriendBalances] = useState<
    { friend: SplitFriend; totalPending: number }[]
  >([]);
  // We keep activeTab solely for fallbacks/logic if needed, but UI represents state via scrollX
  const [activeTab, setActiveTab] = useState<'splits' | 'friends'>('splits');
  const [refreshing, setRefreshing] = useState(false);

  const tabScrollRef = useRef<Animated.ScrollView>(null);
  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
    onMomentumEnd: (event) => {
      const idx = Math.round(event.contentOffset.x / SCREEN_WIDTH);
      runOnJS(setActiveTab)(idx === 1 ? 'friends' : 'splits');
    },
  });

  const handleTabPress = (tab: 'splits' | 'friends') => {
    setActiveTab(tab);
    tabScrollRef.current?.scrollTo({ x: tab === 'friends' ? SCREEN_WIDTH : 0, animated: true });
  };

  const loadSplits = useCallback(async () => {
    const data = await SplitService.getAll();
    setSplits(data);
    const balances = await SplitService.getFriendBalances();
    setFriendBalances(balances);
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

  // Animated Pill Indicator
  const TAB_CONTAINER_PADDING = SPACING.md;
  const TAB_GAP = SPACING.sm;
  const TAB_WIDTH = (SCREEN_WIDTH - TAB_CONTAINER_PADDING * 2 - TAB_GAP) / 2;

  const indicatorStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      scrollX.value,
      [0, SCREEN_WIDTH],
      [0, TAB_WIDTH + TAB_GAP],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ translateX }],
    };
  });

  const textStyleSplits = useAnimatedStyle(() => {
    const color = interpolate(scrollX.value, [0, SCREEN_WIDTH / 2], [1, 0], Extrapolation.CLAMP);
    return { color: color > 0.5 ? colors.textInverse : colors.textSecondary };
  });

  const textStyleFriends = useAnimatedStyle(() => {
    const color = interpolate(
      scrollX.value,
      [SCREEN_WIDTH / 2, SCREEN_WIDTH],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { color: color > 0.5 ? colors.textInverse : colors.textSecondary };
  });

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

      {/* Modern Liquid Tabs */}
      <View style={styles.tabContainer}>
        {/* Animated Background Pill */}
        <Animated.View style={[styles.tabIndicatorPill, indicatorStyle]} />

        <TouchableOpacity
          style={styles.tabBtn}
          onPress={() => handleTabPress('splits')}
          activeOpacity={0.8}
        >
          <Animated.Text style={[styles.tabText, textStyleSplits]}>By Split</Animated.Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabBtn}
          onPress={() => handleTabPress('friends')}
          activeOpacity={0.8}
        >
          <Animated.Text style={[styles.tabText, textStyleFriends]}>By Friend</Animated.Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal paging scroll */}
      <Animated.ScrollView
        ref={tabScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        style={{ flex: 1 }}
        bounces={false}
      >
        {/* Splits tab */}
        <ScrollView
          style={{ width: SCREEN_WIDTH }}
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

        {/* Friends tab */}
        <ScrollView
          style={{ width: SCREEN_WIDTH }}
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
          {friendBalances.length === 0 ? (
            <EmptyState
              icon="person-add-outline"
              title="No friends yet"
              subtitle="Share an expense with friends to add them to your balances"
            />
          ) : (
            friendBalances.map((item, idx) => (
              <FriendCard
                key={item.friend.id}
                item={item}
                colors={colors}
                styles={styles}
                delay={idx * 60}
                onPress={() => router.push(`/split-expense/friend-detail/${item.friend.id}`)}
              />
            ))
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      </Animated.ScrollView>

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

// ─── Friend Card ──────────────────────────────────────────────────────────────
const FriendCard: React.FC<{
  item: { friend: SplitFriend; totalPending: number };
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  delay: number;
  onPress: () => void;
}> = ({ item, colors, styles, delay, onPress }) => {
  const { friend, totalPending } = item;
  const isSettled = totalPending <= 0;

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(100 + delay)}>
      <TouchableOpacity style={styles.friendCard} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.friendCardInner}>
          <View style={[styles.friendAvatar, { backgroundColor: colors.primary + '15' }]}>
            <Text style={[styles.friendInitials, { color: colors.primary }]}>
              {friend.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.friendInfo}>
            <Text style={styles.friendName}>{friend.name}</Text>
            {isSettled ? (
              <Text style={[styles.friendStatus, { color: colors.textMuted }]}>Settled up</Text>
            ) : (
              <Text style={[styles.friendStatus, { color: colors.warning }]}>Owes you</Text>
            )}
          </View>
          <Text
            style={[
              styles.friendAmount,
              { color: isSettled ? colors.textMuted : colors.textPrimary },
            ]}
          >
            {formatCurrency(totalPending)}
          </Text>
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

    // Tabs
    tabContainer: {
      flexDirection: 'row',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      gap: SPACING.sm,
      position: 'relative',
    },
    tabIndicatorPill: {
      position: 'absolute',
      left: SPACING.md,
      top: SPACING.sm,
      bottom: SPACING.sm,
      width: (SCREEN_WIDTH - SPACING.md * 2 - SPACING.sm) / 2,
      backgroundColor: colors.primary,
      borderRadius: RADIUS.md,
      zIndex: 0,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: RADIUS.md,
      backgroundColor: colors.bgElevated,
      zIndex: 1,
    },
    tabText: {
      ...TYPOGRAPHY.body,
      fontWeight: '600',
    },
    indicatorRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      paddingBottom: 6,
    },
    indicatorDot: {
      height: 5,
      width: 5,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    sectionTitle: {
      ...TYPOGRAPHY.h3,
      fontWeight: '700',
    },

    // Friend Card
    friendCard: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: SPACING.sm,
    },
    friendCardInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    friendAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    friendInitials: {
      fontSize: 18,
      fontWeight: '800',
    },
    friendInfo: {
      flex: 1,
    },
    friendName: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    friendStatus: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    friendAmount: {
      ...TYPOGRAPHY.h3,
      fontWeight: '700',
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
