import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, CustomPopup } from '../../components/common';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { SplitService } from '../../services/splitService';
import { useAppStore } from '../../store/appStore';
import { RADIUS, SPACING, TYPOGRAPHY, formatCurrency } from '../../utils/constants';
import type { SplitExpense, SplitMember } from '../../utils/types';
import { logger } from '../../utils/logger';

interface FriendDetailItem {
  expense: SplitExpense;
  member: SplitMember;
  transactionMerchant?: string;
  transactionDate?: string;
}

export default function FriendDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dataRevision = useAppStore((s) => s.dataRevision);

  const [details, setDetails] = useState<FriendDetailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [popupConfig, setPopupConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'success' as 'success' | 'error',
  });

  const loadDetails = useCallback(async () => {
    if (!id) return;
    try {
      const data = await SplitService.getFriendDetails(id);
      setDetails(data);
    } catch (error) {
      logger.warn('FriendDetail', 'Failed to load friend details', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails, dataRevision]);

  const handleSettleUp = useCallback(async () => {
    try {
      if (!id) return;
      await SplitService.settleUpFriend(id);
      setPopupConfig({
        visible: true,
        title: 'Settled Up',
        message: 'All pending balances with this friend have been cleared.',
        type: 'success',
      });
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch {
      setPopupConfig({
        visible: true,
        title: 'Error',
        message: 'Failed to settle up. Please try again.',
        type: 'error',
      });
    }
  }, [id, router]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const pendingItems = details.filter((d) => d.member.status === 'pending');
  const totalOwed = pendingItems.reduce((sum, item) => sum + item.member.shareAmount, 0);
  const friendName = details[0]?.member.name || 'Friend';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{friendName}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.heroCard}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '15' }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {friendName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.heroTitle}>{totalOwed > 0 ? 'Owes you' : 'Settled up'}</Text>
          <Text
            style={[
              styles.heroAmount,
              { color: totalOwed > 0 ? colors.textPrimary : colors.textMuted },
            ]}
          >
            {formatCurrency(totalOwed)}
          </Text>

          {totalOwed > 0 && (
            <TouchableOpacity style={styles.settleBtn} onPress={handleSettleUp} activeOpacity={0.8}>
              <Ionicons name="checkmark-done" size={18} color={colors.textInverse} />
              <Text style={styles.settleBtnText}>Settle Up</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(400).delay(100)}
          style={{ marginTop: SPACING.lg }}
        >
          <Text style={styles.sectionTitle}>Shared Expenses</Text>
          {details.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title="No history"
              subtitle="No shared expenses found."
            />
          ) : (
            details.map((item, idx) => (
              <TouchableOpacity
                key={item.member.id}
                style={styles.historyCard}
                activeOpacity={0.7}
                onPress={() => router.push(`/split-expense/${item.expense.id}`)}
              >
                <View
                  style={[
                    styles.historyIcon,
                    {
                      backgroundColor:
                        item.member.status === 'paid'
                          ? colors.income + '15'
                          : colors.warning + '15',
                    },
                  ]}
                >
                  <Ionicons
                    name={item.member.status === 'paid' ? 'checkmark' : 'time-outline'}
                    size={18}
                    color={item.member.status === 'paid' ? colors.income : colors.warning}
                  />
                </View>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyName}>
                    {item.transactionMerchant || item.expense.notes || 'Expense'}
                  </Text>
                  <Text style={styles.historyDate}>
                    {item.transactionDate
                      ? new Date(item.transactionDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : new Date(item.expense.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                  </Text>
                </View>
                <View style={styles.historyAmountCol}>
                  <Text style={styles.historyAmount}>
                    {formatCurrency(item.member.shareAmount)}
                  </Text>
                  <Text
                    style={[
                      styles.historyStatus,
                      { color: item.member.status === 'paid' ? colors.income : colors.warning },
                    ]}
                  >
                    {item.member.status === 'paid' ? 'Paid' : 'Pending'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </Animated.View>
        <View style={{ height: 100 }} />
      </ScrollView>

      <CustomPopup
        visible={popupConfig.visible}
        title={popupConfig.title}
        message={popupConfig.message}
        type={popupConfig.type}
        onClose={() => setPopupConfig((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

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
    heroCard: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.xl,
      padding: SPACING.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: SPACING.lg,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
    },
    avatarText: {
      fontSize: 28,
      fontWeight: '800',
    },
    heroTitle: {
      ...TYPOGRAPHY.body,
      color: colors.textSecondary,
      fontWeight: '600',
      marginBottom: 4,
    },
    heroAmount: {
      fontSize: 32,
      fontWeight: '800',
      marginBottom: SPACING.lg,
    },
    settleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.full,
      gap: 8,
    },
    settleBtnText: {
      ...TYPOGRAPHY.body,
      color: colors.textInverse,
      fontWeight: '700',
    },
    sectionTitle: {
      ...TYPOGRAPHY.h3,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: SPACING.md,
    },
    historyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: SPACING.sm,
    },
    historyIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: SPACING.md,
    },
    historyInfo: {
      flex: 1,
    },
    historyName: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    historyDate: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      marginTop: 2,
    },
    historyAmountCol: {
      alignItems: 'flex-end',
    },
    historyAmount: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    historyStatus: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
  });
}
