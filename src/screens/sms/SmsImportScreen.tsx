import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { RADIUS, SPACING, TYPOGRAPHY, formatCurrency } from '../../utils/constants';

import { CustomPopup } from '../../components/common';
import { SmsReadService, type ParsedSms } from '../../services/smsReadService';

export default function SmsImportScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [pending, setPending] = useState<ParsedSms[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const [popupConfig, setPopupConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
    onClose?: () => void;
  }>({ visible: false, title: '', message: '', type: 'info' });

  const scanSms = useCallback(async () => {
    setLoading(true);
    try {
      const hasPermission = await SmsReadService.requestPermission();
      if (!hasPermission) {
        setPopupConfig({
          visible: true,
          title: 'Permission Denied',
          message: 'SMS permission is required to scan for transactions.',
          type: 'error',
        });
        return;
      }

      const results = await SmsReadService.scanSms();
      setPending(results);
      setSelectedIds(new Set(results.map((r) => r.id)));
    } catch {
      setPopupConfig({
        visible: true,
        title: 'Error',
        message: 'Failed to scan SMS messages.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void scanSms();
  }, [scanSms]);

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleConfirmAll = async () => {
    if (selectedIds.size === 0) return;

    setLoading(true);
    try {
      const toImport = pending.filter((p) => selectedIds.has(p.id));
      await SmsReadService.importTransactions(toImport);

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPopupConfig({
        visible: true,
        title: 'Success',
        message: `${toImport.length} transactions imported successfully.`,
        type: 'success',
        onClose: () => router.back(),
      });
    } catch {
      setPopupConfig({
        visible: true,
        title: 'Error',
        message: 'Failed to import transactions.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
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
          <TouchableOpacity style={styles.headerIcon} onPress={() => void scanSms()}>
            <Ionicons name="refresh" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => {
              if (selectedIds.size === pending.length) {
                setSelectedIds(new Set());
              } else {
                setSelectedIds(new Set(pending.map((p) => p.id)));
              }
            }}
          >
            <Ionicons
              name={selectedIds.size === pending.length ? 'checkbox' : 'checkbox-outline'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Summary Card */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <Ionicons name="chatbubbles" size={24} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.summaryTitle}>{pending.length} New Messages</Text>
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
        {pending.map((tx, idx) => {
          const isSelected = selectedIds.has(tx.id);
          return (
            <Animated.View key={tx.id} entering={FadeInDown.duration(400).delay(100 + idx * 80)}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => toggleSelection(tx.id)}
                style={[styles.txCard, isSelected && styles.txCardSelected]}
              >
                <View style={styles.txTopRow}>
                  <View
                    style={[
                      styles.txIconBg,
                      {
                        backgroundColor: colors.primary + (isSelected ? '25' : '10'),
                      },
                    ]}
                  >
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'mail-outline'}
                      size={20}
                      color={isSelected ? colors.primary : colors.textMuted}
                    />
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txBank}>
                      {tx.sender} • {new Date(tx.date).toLocaleDateString()}
                    </Text>
                    <Text style={styles.txMerchant}>{tx.merchant}</Text>
                    <Text style={styles.txBody} numberOfLines={2}>
                      {tx.body}
                    </Text>
                  </View>
                  <View style={styles.txAmountCol}>
                    <Text style={styles.txAmount}>{formatCurrency(tx.amount)}</Text>
                    <Text
                      style={[
                        styles.txType,
                        {
                          color: tx.type === 'income' ? colors.income : colors.expense,
                        },
                      ]}
                    >
                      {tx.type === 'income' ? 'CREDIT' : 'DEBIT'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {pending.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={48} color={colors.income} />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>No pending SMS transactions to review.</Text>
          </View>
        )}
      </ScrollView>

      {/* Confirm All Footer */}
      {pending.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.confirmAllBtn,
              {
                backgroundColor: selectedIds.size > 0 ? colors.primary : colors.bgElevated,
              },
            ]}
            onPress={() => void handleConfirmAll()}
            disabled={selectedIds.size === 0 || loading}
          >
            <Text
              style={[
                styles.confirmAllText,
                { color: selectedIds.size > 0 ? '#fff' : colors.textMuted },
              ]}
            >
              {loading ? 'Importing...' : `Import Selected (${selectedIds.size})`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <CustomPopup
        visible={popupConfig.visible}
        title={popupConfig.title}
        message={popupConfig.message}
        type={popupConfig.type}
        onClose={() => {
          setPopupConfig((prev) => ({ ...prev, visible: false }));
          if (popupConfig.onClose) {
            setTimeout(popupConfig.onClose, 300);
          }
        }}
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
      borderRadius: RADIUS.md,
      backgroundColor: colors.primary,
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
    txCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '05',
    },
    txTopRow: { flexDirection: 'row', gap: 12 },
    txIconBg: {
      width: 48,
      height: 48,
      borderRadius: 24,
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
      fontSize: 17,
      color: colors.textPrimary,
      fontWeight: '700',
      marginTop: 2,
    },
    txBody: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      marginTop: 4,
    },
    txAmountCol: { alignItems: 'flex-end' },
    txAmount: {
      fontSize: 18,
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
}
