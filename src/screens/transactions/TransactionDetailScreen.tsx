import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
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
import { CustomPopup } from '../../components/common';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { AccountService } from '../../services/dataServices';
import { TransactionService } from '../../services/transactionService';
import { RADIUS, SPACING, TYPOGRAPHY, formatCurrency } from '../../utils/constants';
import type { IoniconsName, Transaction } from '../../utils/types';

const safeFormatDate = (dateStr: string, fmt: string): string => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return format(d, fmt);
  } catch {
    return dateStr;
  }
};

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toAccountName, setToAccountName] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      const data = await TransactionService.getById(id);
      setTx(data ?? null);
      if (data?.toAccountId) {
        const accounts = await AccountService.getAll();
        const toAcc = accounts.find((a) => a.id === data.toAccountId);
        setToAccountName(toAcc?.name ?? data.toAccountId);
      }
    } catch {
      setTx(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    if (!id) return;
    try {
      await TransactionService.delete(id);
    } catch {
      // ignore delete errors
    }
    router.back();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Transaction" />
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!tx) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Transaction" />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Transaction not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const amountColor =
    tx.type === 'income' ? colors.income : tx.type === 'expense' ? colors.expense : colors.transfer;

  const prefix = tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '↔';
  const typeLabel = tx?.type?.charAt(0)?.toUpperCase() + tx?.type?.slice(1);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Transaction Details"
        rightAction={{
          icon: 'create-outline' as IoniconsName,
          onPress: () => router.push(`/transactions/${id}?edit=1` as Href),
        }}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Amount Card */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={styles.amountCard}>
            <View style={[styles.typeChip, { backgroundColor: amountColor + '20' }]}>
              <Text style={[styles.typeText, { color: amountColor }]}>{typeLabel}</Text>
            </View>
            <Text style={[styles.amount, { color: amountColor }]}>
              {prefix}
              {formatCurrency(tx.amount)}
            </Text>
            {tx.date && (
              <Text style={styles.dateText}>{safeFormatDate(tx.date, 'EEEE, dd MMMM yyyy')}</Text>
            )}
          </View>
        </Animated.View>

        {/* Details Section */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <Text style={styles.sectionTitle}>DETAILS</Text>

          <DetailRow
            icon={(tx.categoryIcon || 'folder') as IoniconsName}
            iconColor={tx.categoryColor || colors.primary}
            label="Category"
            value={tx.categoryName || 'Unknown'}
            colors={colors}
          />

          <DetailRow
            icon="wallet"
            iconColor={colors.primary}
            label="Account"
            value={tx.accountName || 'Unknown'}
            colors={colors}
          />

          {tx.type === 'transfer' && tx.toAccountId && (
            <DetailRow
              icon="swap-horizontal"
              iconColor={colors.transfer}
              label="Destination"
              value={toAccountName ?? tx.toAccountId}
              colors={colors}
            />
          )}

          <DetailRow
            icon="card"
            iconColor={colors.primary}
            label="Payment Method"
            value={tx.paymentMethod || 'N/A'}
            colors={colors}
          />

          {tx.date && (
            <DetailRow
              icon="time"
              iconColor={colors.primary}
              label="Time"
              value={safeFormatDate(tx.date, 'hh:mm a')}
              colors={colors}
            />
          )}

          {tx.merchant && (
            <DetailRow
              icon="storefront"
              iconColor={colors.primary}
              label="Merchant"
              value={tx.merchant}
              colors={colors}
            />
          )}

          {tx.notes ? (
            <DetailRow
              icon="document-text"
              iconColor={colors.primary}
              label="Notes"
              value={tx.notes}
              colors={colors}
            />
          ) : null}
        </Animated.View>

        {/* Tags */}
        {Array.isArray(tx.tags) && tx.tags.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(200)}>
            <Text style={styles.sectionTitle}>TAGS</Text>
            <View style={styles.tagsRow}>
              {tx.tags.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Actions */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)}>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.primary + '40' }]}
              onPress={() => router.push(`/transactions/${id}?edit=1` as Href)}
            >
              <Ionicons name="create-outline" size={20} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.expense + '40' }]}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={20} color={colors.expense} />
              <Text style={[styles.actionBtnText, { color: colors.expense }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <View style={{ height: 80 }} />
      </ScrollView>
      <CustomPopup
        visible={showDeleteConfirm}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction?"
        type="error"
        onClose={() => setShowDeleteConfirm(false)}
        actions={[{ label: 'Delete', onPress: confirmDelete }]}
      />
    </SafeAreaView>
  );
}

const DetailRow: React.FC<{
  icon: IoniconsName;
  iconColor: string;
  label: string;
  value: string;
  colors: ThemeColors;
}> = ({ icon, iconColor, label, value, colors }) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: SPACING.md,
      gap: SPACING.md,
    }}
  >
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: RADIUS.md,
        backgroundColor: iconColor + '15',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={20} color={iconColor} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={{ ...TYPOGRAPHY.caption, color: colors.textMuted }}>{label}</Text>
      <Text
        style={{
          ...TYPOGRAPHY.body,
          color: colors.textPrimary,
          fontWeight: '600',
          marginTop: 2,
        }}
      >
        {value}
      </Text>
    </View>
  </View>
);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: SPACING.md, paddingBottom: 40 },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { ...TYPOGRAPHY.body, color: colors.textMuted },
    amountCard: {
      alignItems: 'center',
      paddingVertical: SPACING.xl,
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: SPACING.lg,
    },
    typeChip: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: RADIUS.full,
      marginBottom: SPACING.sm,
    },
    typeText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
    amount: { fontSize: 32, fontWeight: '800' },
    dateText: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      marginTop: 6,
    },
    sectionTitle: {
      ...TYPOGRAPHY.label,
      color: colors.textMuted,
      marginLeft: SPACING.md,
      marginTop: SPACING.lg,
      marginBottom: SPACING.sm,
      fontWeight: '800',
      letterSpacing: 1.5,
    },
    tagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.md,
    },
    tagChip: {
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: RADIUS.full,
    },
    tagText: {
      ...TYPOGRAPHY.caption,
      color: colors.primary,
      fontWeight: '700',
    },
    actionsRow: {
      flexDirection: 'row',
      gap: SPACING.md,
      paddingHorizontal: SPACING.md,
      marginTop: SPACING.xl,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
    },
    actionBtnText: { fontSize: 15, fontWeight: '700' },
  });
