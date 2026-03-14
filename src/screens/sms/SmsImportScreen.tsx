import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { SPACING, RADIUS, TYPOGRAPHY, formatCurrency } from '@/utils/constants';

import { TransactionService } from '@/services/transactionService';

interface PendingTransaction {
  id: string;
  bankName: string;
  time: string;
  merchant: string;
  category: string;
  amount: number;
  type: 'debit' | 'credit';
  icon: string;
  iconColor: string;
  rawTags: string[];
}

export default function SmsImportScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [pending, setPending] = useState<PendingTransaction[]>([]);

  const loadTransactions = useCallback(async () => {
    const txs = await TransactionService.getAll(
      { search: 'sms-import' },
      100,
      0,
    );
    // Filter out transactions that no longer have 'sms-import' in their actual tags array (just in case)
    const pendingTxs = txs.filter((tx) => tx.tags.includes('sms-import'));

    setPending(
      pendingTxs.map((tx) => ({
        id: tx.id,
        bankName: tx.accountName || 'UNKNOWN',
        time: new Date(tx.date).toLocaleDateString(),
        merchant: tx.merchant || 'Unknown',
        category: tx.categoryName || 'GENERAL',
        amount: tx.amount,
        type: tx.type === 'income' ? 'credit' : 'debit',
        icon: tx.categoryIcon || 'list',
        iconColor: tx.categoryColor || colors.primary,
        rawTags: tx.tags,
      })),
    );
  }, [colors]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const handleConfirm = async (id: string) => {
    const tx = await TransactionService.getById(id);
    if (tx) {
      await TransactionService.update(id, {
        tags: tx.tags.filter((t) => t !== 'sms-import'),
      });
      void loadTransactions();
    }
  };

  const handleDismiss = async (id: string) => {
    await TransactionService.delete(id);
    void loadTransactions();
  };

  const handleEdit = (id: string) => {
    router.push({
      pathname: '/transactions/[id]',
      params: { id },
    });
  };

  const handleConfirmAll = async () => {
    for (const p of pending) {
      const tx = await TransactionService.getById(p.id);
      if (tx) {
        await TransactionService.update(p.id, {
          tags: tx.tags.filter((t) => t !== 'sms-import'),
        });
      }
    }
    void loadTransactions();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Import Transactions</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="refresh" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons
              name="ellipsis-vertical"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Card */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <Ionicons name="chatbubbles" size={24} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.summaryTitle}>
                {pending.length} New Messages
              </Text>
              <Text style={styles.summarySubtitle}>
                We found {pending.length} transactions to import
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Section Label */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>PENDING REVIEW</Text>
          <View style={styles.autoBadge}>
            <Text style={styles.autoBadgeText}>AUTO-DETECTED</Text>
          </View>
        </View>

        {/* Pending Transaction Cards */}
        {pending.map((tx, idx) => (
          <Animated.View
            key={tx.id}
            entering={FadeInDown.duration(400).delay(100 + idx * 80)}
          >
            <View style={styles.txCard}>
              <View style={styles.txTopRow}>
                <View
                  style={[
                    styles.txIconBg,
                    { backgroundColor: tx.iconColor + '20' },
                  ]}
                >
                  <Ionicons
                    name={tx.icon as never}
                    size={20}
                    color={tx.iconColor}
                  />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txBank}>
                    {tx.bankName} • {tx.time}
                  </Text>
                  <Text style={styles.txMerchant}>{tx.merchant}</Text>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{tx.category}</Text>
                  </View>
                </View>
                <View style={styles.txAmountCol}>
                  <Text style={styles.txAmount}>
                    {formatCurrency(tx.amount)}
                  </Text>
                  <Text
                    style={[
                      styles.txType,
                      {
                        color:
                          tx.type === 'credit' ? colors.income : colors.expense,
                      },
                    ]}
                  >
                    {tx.type === 'credit' ? 'CREDIT' : 'DEBIT'}
                  </Text>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.txActions}>
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={() => handleConfirm(tx.id)}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  <Text style={styles.confirmBtnText}>Confirm</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => handleEdit(tx.id)}
                >
                  <Ionicons
                    name="pencil"
                    size={14}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dismissBtn}
                  onPress={() => handleDismiss(tx.id)}
                >
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        ))}

        {pending.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={48} color={colors.income} />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>
              No pending SMS transactions to review.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Confirm All Footer */}
      {pending.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.confirmAllBtn}
            onPress={handleConfirmAll}
          >
            <Text style={styles.confirmAllText}>
              Confirm All ({pending.length}) »
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: { padding: 4 },
    title: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      flex: 1,
      marginLeft: SPACING.sm,
    },
    headerActions: { flexDirection: 'row', gap: SPACING.sm },
    headerIcon: { padding: 4 },
    scroll: { padding: SPACING.md, paddingBottom: 120 },

    // Summary
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      backgroundColor: colors.primary + '15',
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.primary + '30',
      marginBottom: SPACING.lg,
    },
    summaryIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryTitle: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    summarySubtitle: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },

    // Section
    sectionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    sectionLabel: {
      ...TYPOGRAPHY.label,
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    autoBadge: {
      backgroundColor: colors.primary + '20',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: RADIUS.full,
    },
    autoBadgeText: {
      ...TYPOGRAPHY.caption,
      color: colors.primary,
      fontWeight: '700',
      fontSize: 10,
    },

    // Transaction Card
    txCard: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: SPACING.md,
    },
    txTopRow: { flexDirection: 'row', gap: 12 },
    txIconBg: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    txInfo: { flex: 1 },
    txBank: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      fontSize: 10,
      textTransform: 'uppercase',
    },
    txMerchant: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
      marginTop: 2,
    },
    categoryBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.bgElevated,
      borderRadius: RADIUS.full,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginTop: 4,
    },
    categoryBadgeText: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      fontSize: 10,
      fontWeight: '600',
    },
    txAmountCol: { alignItems: 'flex-end' },
    txAmount: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    txType: {
      ...TYPOGRAPHY.caption,
      fontSize: 10,
      fontWeight: '700',
      marginTop: 2,
    },

    // Actions
    txActions: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginTop: SPACING.md,
    },
    confirmBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: RADIUS.md,
      flex: 1,
      justifyContent: 'center',
    },
    confirmBtnText: { ...TYPOGRAPHY.caption, color: '#fff', fontWeight: '700' },
    editBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.bgElevated,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: RADIUS.md,
    },
    editBtnText: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    dismissBtn: {
      width: 40,
      height: 40,
      borderRadius: RADIUS.md,
      backgroundColor: colors.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Empty
    emptyState: { alignItems: 'center', paddingVertical: 48, gap: SPACING.sm },
    emptyTitle: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    emptySubtitle: { ...TYPOGRAPHY.caption, color: colors.textMuted },

    // Footer
    footer: {
      position: 'absolute',
      bottom: 80,
      left: SPACING.lg,
      right: SPACING.lg,
      alignItems: 'center',
    },
    confirmAllBtn: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.full,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    },
    confirmAllText: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
  });
