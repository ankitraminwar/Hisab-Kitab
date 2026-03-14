import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { format } from 'date-fns';
import {
  SPACING,
  RADIUS,
  TYPOGRAPHY,
  formatCurrency,
} from '../../utils/constants';
import { TransactionService } from '../../services/transactionService';
import { useAppStore } from '../../store/appStore';
import { SearchBar } from '../../components/common';
import TransactionItem from '../../components/TransactionItem';
import type {
  Transaction,
  TransactionType,
  TransactionFilters,
  Category,
  Account,
} from '../../utils/types';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';

type FilterType = 'all' | 'expense' | 'income' | 'transfer';
type ListItem =
  | { type: 'header'; title: string; key: string }
  | { type: 'transaction'; data: Transaction; key: string };

const FILTER_CHIPS: { key: string; label: string; icon: string }[] = [
  { key: 'category', label: 'Category', icon: 'chevron-down' },
  { key: 'account', label: 'Account', icon: 'chevron-down' },
  { key: 'date', label: 'Date', icon: 'chevron-down' },
];

export default function TransactionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const dataRevision = useAppStore((state) => state.dataRevision);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<TransactionType | undefined>();
  const [filterCat, setFilterCat] = useState<string | undefined>();
  const [filterAcc, setFilterAcc] = useState<string | undefined>();
  const [filterMonth, setFilterMonth] = useState<string | undefined>();

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const loadData = useCallback(async () => {
    const filters: TransactionFilters = {
      type: filterType,
      categoryId: filterCat,
      accountId: filterAcc,
    };
    const results = await TransactionService.getAll(filters);
    setTransactions(results);
  }, [filterType, filterCat, filterAcc]);

  useEffect(() => {
    void loadData();
  }, [dataRevision, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.toLowerCase();
    return transactions.filter(
      (t) =>
        t.merchant?.toLowerCase().includes(q) ||
        t.categoryName?.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q),
    );
  }, [transactions, search]);

  // Group by month
  const listData = useMemo((): ListItem[] => {
    const items: ListItem[] = [];
    let currentMonth = '';
    for (const tx of filtered) {
      const monthKey = format(new Date(tx.date), 'MMMM yyyy').toUpperCase();
      if (monthKey !== currentMonth) {
        currentMonth = monthKey;
        items.push({
          type: 'header',
          title: monthKey,
          key: `header-${monthKey}`,
        });
      }
      items.push({ type: 'transaction', data: tx, key: tx.id });
    }
    return items;
  }, [filtered]);

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.monthHeader}>
          <Text style={styles.monthText}>{item.title}</Text>
        </View>
      );
    }
    return (
      <View style={styles.txCardWrapper}>
        <TransactionItem
          item={item.data}
          onPress={() => router.push(`/transactions/${item.data.id}`)}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <TouchableOpacity style={styles.menuBtn}>
          <Ionicons name="menu" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Transactions</Text>
        <TouchableOpacity style={styles.menuBtn}>
          <Ionicons
            name="notifications-outline"
            size={22}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </Animated.View>

      {/* Search */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(100)}
        style={styles.searchWrap}
      >
        <SearchBar
          placeholder="Search transactions..."
          value={search}
          onChangeText={setSearch}
        />
      </Animated.View>

      {/* Filter Chips */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(150)}
        style={styles.filterRow}
      >
        {FILTER_CHIPS.map((chip) => (
          <TouchableOpacity key={chip.key} style={styles.filterChip}>
            <Text style={styles.filterChipText}>{chip.label}</Text>
            <Ionicons
              name={chip.icon as never}
              size={14}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* Transaction List */}
      <FlatList
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        contentContainerStyle={{
          paddingHorizontal: SPACING.md,
          paddingBottom: 100,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="receipt-outline"
              size={48}
              color={colors.textMuted}
            />
            <Text style={styles.emptyTitle}>No transactions found</Text>
            <Text style={styles.emptySubtitle}>
              {search
                ? 'Try a different search term'
                : 'Tap + to add your first transaction'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    menuBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
    },
    title: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    searchWrap: { paddingHorizontal: SPACING.md, marginBottom: SPACING.sm },
    filterRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.md,
      marginBottom: SPACING.sm,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: RADIUS.full,
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipText: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    monthHeader: {
      paddingVertical: SPACING.sm,
      paddingHorizontal: 4,
      marginTop: SPACING.sm,
    },
    monthText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    txCardWrapper: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: SPACING.sm,
      overflow: 'hidden',
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 60,
      gap: SPACING.sm,
    },
    emptyTitle: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    emptySubtitle: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
    },
  });
