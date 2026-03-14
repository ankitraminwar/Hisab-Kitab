import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SearchBar } from '../../components/common';
import TransactionItem from '../../components/TransactionItem';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { AccountService, CategoryService } from '../../services/dataServices';
import { TransactionService } from '../../services/transactionService';
import { useAppStore } from '../../store/appStore';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../utils/constants';
import type {
  Account,
  Category,
  Transaction,
  TransactionFilters,
  TransactionType,
} from '../../utils/types';

type ListItem =
  | { type: 'header'; title: string; key: string }
  | { type: 'transaction'; data: Transaction; key: string };

interface FilterChip {
  key: string;
  label: string;
  icon: string;
  active: boolean;
}

const PAGE_SIZE = 20;

export default function TransactionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const dataRevision = useAppStore((state) => state.dataRevision);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const [filterType, setFilterType] = useState<TransactionType | undefined>();
  const [filterCat, setFilterCat] = useState<string | undefined>();
  const [filterAcc, setFilterAcc] = useState<string | undefined>();

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showCatFilter, setShowCatFilter] = useState(false);
  const [showAccFilter, setShowAccFilter] = useState(false);
  const [showTypeFilter, setShowTypeFilter] = useState(false);

  const buildFilters = useCallback(
    () => ({
      type: filterType,
      categoryId: filterCat,
      accountId: filterAcc,
      search: search.trim() || undefined,
    }),
    [filterType, filterCat, filterAcc, search],
  );

  const loadData = useCallback(
    async (offset = 0, replace = true) => {
      const filters: TransactionFilters = buildFilters();
      const results = await TransactionService.getAll(
        filters,
        PAGE_SIZE,
        offset,
      );
      setTransactions((prev) => (replace ? results : [...prev, ...results]));
      setHasMore(results.length === PAGE_SIZE);
      setPage(offset / PAGE_SIZE);
    },
    [buildFilters],
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextOffset = (page + 1) * PAGE_SIZE;
    await loadData(nextOffset, false);
    setLoadingMore(false);
  }, [loadingMore, hasMore, page, loadData]);

  useEffect(() => {
    void (async () => {
      const [cats, accs] = await Promise.all([
        CategoryService.getAll(),
        AccountService.getAll(),
      ]);
      setCategories(cats);
      setAccounts(accs);
    })();
  }, []);

  useEffect(() => {
    void loadData(0, true);
  }, [dataRevision, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(0, true);
    setRefreshing(false);
  };

  // Group by month
  const listData = useMemo((): ListItem[] => {
    const items: ListItem[] = [];
    let currentMonth = '';
    for (const tx of transactions) {
      const monthKey = format(new Date(tx.date), 'MMMM yyyy');
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
  }, [transactions]);

  const filterChips: FilterChip[] = useMemo(
    () => [
      {
        key: 'type',
        label: filterType
          ? filterType.charAt(0).toUpperCase() + filterType.slice(1)
          : 'Type',
        icon: 'swap-vertical',
        active: Boolean(filterType),
      },
      {
        key: 'category',
        label: filterCat
          ? (categories.find((c) => c.id === filterCat)?.name ?? 'Category')
          : 'Category',
        icon: 'pricetag',
        active: Boolean(filterCat),
      },
      {
        key: 'account',
        label: filterAcc
          ? (accounts.find((a) => a.id === filterAcc)?.name ?? 'Account')
          : 'Account',
        icon: 'wallet',
        active: Boolean(filterAcc),
      },
    ],
    [filterType, filterCat, filterAcc, categories, accounts],
  );

  const handleChipPress = (key: string) => {
    if (key === 'type') setShowTypeFilter((v) => !v);
    if (key === 'category') setShowCatFilter((v) => !v);
    if (key === 'account') setShowAccFilter((v) => !v);
  };

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === 'header') {
        return (
          <View style={styles.monthHeader}>
            <Text style={styles.monthText}>{item.title}</Text>
          </View>
        );
      }
      const tx = item.data;
      const debitCredit =
        tx.type === 'income'
          ? 'CREDIT'
          : tx.type === 'expense'
            ? 'DEBIT'
            : null;
      return (
        <View style={styles.txCardWrapper}>
          <TransactionItem
            item={tx}
            onPress={() => router.push(`/transactions/${tx.id}`)}
          />
          {debitCredit && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor:
                    debitCredit === 'CREDIT'
                      ? colors.income + '20'
                      : colors.expense + '20',
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  {
                    color:
                      debitCredit === 'CREDIT' ? colors.income : colors.expense,
                  },
                ]}
              >
                {debitCredit}
              </Text>
            </View>
          )}
        </View>
      );
    },
    [styles, colors, router],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
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

      {/* Filter Chips — horizontal scroll */}
      <Animated.View entering={FadeInDown.duration(400).delay(150)}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filterChips.map((chip) => (
            <TouchableOpacity
              key={chip.key}
              style={[
                styles.filterChip,
                chip.active && styles.filterChipActive,
              ]}
              onPress={() => handleChipPress(chip.key)}
            >
              <Ionicons
                name={chip.icon as never}
                size={13}
                color={chip.active ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.filterChipText,
                  chip.active && { color: colors.primary },
                ]}
              >
                {chip.label}
              </Text>
              {chip.active && (
                <TouchableOpacity
                  onPress={() => {
                    if (chip.key === 'type') setFilterType(undefined);
                    if (chip.key === 'category') setFilterCat(undefined);
                    if (chip.key === 'account') setFilterAcc(undefined);
                  }}
                >
                  <Ionicons
                    name="close-circle"
                    size={14}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              )}
              {!chip.active && (
                <Ionicons
                  name="chevron-down"
                  size={12}
                  color={colors.textMuted}
                />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Inline filter dropdowns */}
      {showTypeFilter && (
        <View style={styles.dropdown}>
          {(['expense', 'income', 'transfer'] as TransactionType[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={styles.dropdownItem}
              onPress={() => {
                setFilterType(filterType === t ? undefined : t);
                setShowTypeFilter(false);
              }}
            >
              <Text
                style={[
                  styles.dropdownText,
                  filterType === t && {
                    color: colors.primary,
                    fontWeight: '700',
                  },
                ]}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
              {filterType === t && (
                <Ionicons name="checkmark" size={16} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {showCatFilter && (
        <ScrollView style={styles.dropdownScrollable} nestedScrollEnabled>
          {categories.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.dropdownItem}
              onPress={() => {
                setFilterCat(filterCat === c.id ? undefined : c.id);
                setShowCatFilter(false);
              }}
            >
              <Text
                style={[
                  styles.dropdownText,
                  filterCat === c.id && {
                    color: colors.primary,
                    fontWeight: '700',
                  },
                ]}
              >
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {showAccFilter && (
        <View style={styles.dropdown}>
          {accounts.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={styles.dropdownItem}
              onPress={() => {
                setFilterAcc(filterAcc === a.id ? undefined : a.id);
                setShowAccFilter(false);
              }}
            >
              <Text
                style={[
                  styles.dropdownText,
                  filterAcc === a.id && {
                    color: colors.primary,
                    fontWeight: '700',
                  },
                ]}
              >
                {a.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Transaction List */}
      <FlashList<ListItem>
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        // @ts-ignore - Property does not exist on type 'IntrinsicAttributes & FlashListProps<ListItem>', likely due to generic type conflict in this environment
        estimatedItemSize={70}
        contentContainerStyle={{
          paddingHorizontal: SPACING.md,
          paddingTop: SPACING.md,
          paddingBottom: 100,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="receipt-outline"
                size={40}
                color={colors.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>No transactions found</Text>
            <Text style={styles.emptySubtitle}>
              Try adjusting your filters or add a new transaction
            </Text>
            <TouchableOpacity
              style={[styles.emptyCtaBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/transactions/add')}
            >
              <Text style={styles.emptyCtaText}>Add Transaction</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMore}>
              <Text style={styles.loadingMoreText}>Loading more…</Text>
            </View>
          ) : null
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
      gap: SPACING.sm,
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.sm,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: RADIUS.xl,
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: {
      borderColor: colors.primary + '30',
      backgroundColor: colors.primary + '10',
    },
    filterChipText: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    dropdown: {
      marginHorizontal: SPACING.md,
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: SPACING.sm,
    },
    dropdownScrollable: {
      maxHeight: 200,
      marginHorizontal: SPACING.md,
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: SPACING.sm,
    },
    dropdownItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dropdownText: {
      ...TYPOGRAPHY.body,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    monthHeader: {
      paddingVertical: SPACING.sm,
      paddingHorizontal: 4,
      marginTop: SPACING.sm,
    },
    monthText: {
      fontSize: 11,
      fontWeight: '700',
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
    badge: {
      alignSelf: 'flex-start',
      marginHorizontal: SPACING.md,
      marginBottom: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: RADIUS.full,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 60,
      gap: SPACING.sm,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.sm,
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
    emptyCtaBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: RADIUS.full,
      marginTop: SPACING.sm,
    },
    emptyCtaText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#fff',
    },
    loadingMore: {
      alignItems: 'center',
      paddingVertical: SPACING.md,
    },
    loadingMoreText: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
    },
  });
