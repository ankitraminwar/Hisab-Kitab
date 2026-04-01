import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import type BottomSheetLib from '@gorhom/bottom-sheet';
import { endOfMonth, format, startOfMonth, subDays, subMonths } from 'date-fns';
import { useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AmountText, Button, CustomModal, SearchBar } from '../../components/common';
import { showToast } from '../../components/common/Toast';
import { SwipeableTransactionItem } from '../../components/common/SwipeableTransactionItem';
import { FilterBottomSheet, type AppliedFilters } from '../../components/common/FilterBottomSheet';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { AccountService, CategoryService } from '../../services/dataServices';
import { triggerBackgroundSync } from '../../services/syncService';
import { TransactionService } from '../../services/transactionService';
import { useAppStore } from '../../store/appStore';
import { RADIUS, SPACING, TYPOGRAPHY, formatCurrency } from '../../utils/constants';
import type {
  Account,
  Category,
  Transaction,
  TransactionFilters,
  TransactionType,
} from '../../utils/types';

type ListItem =
  | { type: 'header'; title: string; key: string; total: number }
  | { type: 'transaction'; data: Transaction; key: string };

const PAGE_SIZE = 20;

const QUICK_DATE_LABELS: Record<string, string> = {
  '7d': 'Last 7 Days',
  thisMonth: 'This Month',
  lastMonth: 'Last Month',
  thisYear: 'This Year',
};

// ─── Transaction Preview Sheet ────────────────────────────────────────────────
const TransactionPreviewSheet: React.FC<{
  transaction: Transaction | null;
  visible: boolean;
  onClose: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}> = ({ transaction, visible, onClose, onEdit, onDelete, colors }) => {
  const isSmsImported = transaction?.tags?.some((t) => t.startsWith('sms:')) ?? false;
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <CustomModal
      visible={visible}
      onClose={() => {
        setConfirmDelete(false);
        onClose();
      }}
      hideCloseBtn
    >
      {transaction && !confirmDelete && (
        <>
          <AmountText
            amount={transaction.amount}
            type={transaction.type}
            size="xl"
            style={{ marginTop: 12 }}
          />

          <View style={previewStyles.detailGrid}>
            {transaction.categoryName ? (
              <View style={[previewStyles.chip, { backgroundColor: colors.bgElevated }]}>
                <Ionicons name="pricetag" size={14} color={colors.textSecondary} />
                <Text
                  style={[previewStyles.chipText, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {transaction.categoryName}
                </Text>
              </View>
            ) : null}
            {transaction.accountName ? (
              <View style={[previewStyles.chip, { backgroundColor: colors.bgElevated }]}>
                <Ionicons name="wallet" size={14} color={colors.textSecondary} />
                <Text
                  style={[previewStyles.chipText, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {transaction.accountName}
                </Text>
              </View>
            ) : null}
            {transaction.paymentMethod ? (
              <View style={[previewStyles.chip, { backgroundColor: colors.bgElevated }]}>
                <Ionicons name="card" size={14} color={colors.textSecondary} />
                <Text
                  style={[previewStyles.chipText, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {transaction.paymentMethod}
                </Text>
              </View>
            ) : null}
            <View style={[previewStyles.chip, { backgroundColor: colors.bgElevated }]}>
              <Ionicons name="calendar" size={14} color={colors.textSecondary} />
              <Text style={[previewStyles.chipText, { color: colors.textPrimary }]}>
                {transaction.date ? format(new Date(transaction.date), 'dd MMM yyyy') : ''}
              </Text>
            </View>
          </View>

          {transaction.notes ? (
            <Text
              style={{
                color: colors.textSecondary,
                marginTop: 16,
                fontSize: 14,
              }}
              numberOfLines={3}
            >
              {transaction.notes}
            </Text>
          ) : null}

          {isSmsImported && (
            <View style={[previewStyles.smsBadge, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="chatbubble-ellipses" size={14} color={colors.primary} />
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 12,
                  fontWeight: '600',
                }}
              >
                Imported from SMS
              </Text>
            </View>
          )}

          <View style={previewStyles.actions}>
            <Button
              title="Delete"
              variant="danger"
              onPress={() => setConfirmDelete(true)}
              style={{ flex: 1 }}
            />
            {!isSmsImported && (
              <Button
                title="Edit"
                variant="primary"
                onPress={() => {
                  onEdit(transaction.id);
                  onClose();
                }}
                style={{ flex: 1 }}
              />
            )}
          </View>
        </>
      )}
      {transaction && confirmDelete && (
        <>
          <Text style={{ ...TYPOGRAPHY.h3, color: colors.textPrimary, marginBottom: SPACING.sm }}>
            Delete Transaction
          </Text>
          <Text
            style={{ ...TYPOGRAPHY.body, color: colors.textSecondary, marginBottom: SPACING.lg }}
          >
            Are you sure you want to delete this transaction?
          </Text>
          <View style={{ flexDirection: 'row', gap: SPACING.md }}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => setConfirmDelete(false)}
              style={{ flex: 1 }}
            />
            <Button
              title="Delete"
              onPress={() => {
                void (async () => {
                  await TransactionService.delete(transaction.id);
                  showToast.success('Transaction deleted');
                  setConfirmDelete(false);
                  onDelete(transaction.id);
                })();
              }}
              style={{ flex: 1, backgroundColor: colors.expense }}
            />
          </View>
        </>
      )}
    </CustomModal>
  );
};

const previewStyles = StyleSheet.create({
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  smsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function TransactionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const dataRevision = useAppStore((state) => state.dataRevision);
  const [previewTx, setPreviewTx] = useState<Transaction | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const [filterType, setFilterType] = useState<TransactionType | undefined>();
  const [filterCat, setFilterCat] = useState<string | undefined>();
  const [filterAcc, setFilterAcc] = useState<string | undefined>();

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const filterSheetRef = useRef<BottomSheetLib>(null);

  // Quick date filter
  type QuickDateFilter = 'all' | '7d' | 'thisMonth' | 'lastMonth' | 'thisYear';
  const [quickDate, setQuickDate] = useState<QuickDateFilter>('all');

  const getDateRange = useCallback((filter: QuickDateFilter) => {
    const today = new Date();
    const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
    switch (filter) {
      case '7d':
        return { dateFrom: fmt(subDays(today, 7)), dateTo: fmt(today) };
      case 'thisMonth':
        return { dateFrom: fmt(startOfMonth(today)), dateTo: fmt(endOfMonth(today)) };
      case 'lastMonth': {
        const prev = subMonths(today, 1);
        return { dateFrom: fmt(startOfMonth(prev)), dateTo: fmt(endOfMonth(prev)) };
      }
      case 'thisYear': {
        const jan1 = new Date(today.getFullYear(), 0, 1);
        const dec31 = new Date(today.getFullYear(), 11, 31);
        return { dateFrom: fmt(jan1), dateTo: fmt(dec31) };
      }
      default:
        return { dateFrom: undefined, dateTo: undefined };
    }
  }, []);

  // Debounce search input
  const handleSearchChange = useCallback((text: string) => {
    setSearch(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(text);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const buildFilters = useCallback(() => {
    const range = getDateRange(quickDate);
    return {
      type: filterType,
      categoryId: filterCat,
      accountId: filterAcc,
      search: debouncedSearch.trim() || undefined,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
    };
  }, [filterType, filterCat, filterAcc, debouncedSearch, quickDate, getDateRange]);

  const loadData = useCallback(
    async (offset = 0, replace = true) => {
      const filters: TransactionFilters = buildFilters();
      const results = await TransactionService.getAll(filters, PAGE_SIZE, offset);
      setTransactions((prev) => (replace ? results : [...prev, ...results]));
      setHasMore(results.length === PAGE_SIZE);
      setPage(offset / PAGE_SIZE);
    },
    [buildFilters],
  );

  const loadMoreRef = useRef(false);
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loadMoreRef.current) return;
    loadMoreRef.current = true;
    setLoadingMore(true);
    const nextOffset = (page + 1) * PAGE_SIZE;
    await loadData(nextOffset, false);
    setLoadingMore(false);
    loadMoreRef.current = false;
  }, [loadingMore, hasMore, page, loadData]);

  useEffect(() => {
    void (async () => {
      const [cats, accs] = await Promise.all([CategoryService.getAll(), AccountService.getAll()]);
      setCategories(cats);
      setAccounts(accs);
    })();
    void loadData(0, true);
  }, [dataRevision, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await triggerBackgroundSync('pull-to-refresh');
    await loadData(0, true);
    setRefreshing(false);
  };

  // Group by month with totals
  const listData = useMemo((): ListItem[] => {
    const items: ListItem[] = [];
    let currentMonth = '';
    let monthTotal = 0;
    let headerIndex = -1;

    for (const tx of transactions) {
      const monthKey = format(new Date(tx.date), 'MMMM yyyy');
      if (monthKey !== currentMonth) {
        if (headerIndex >= 0 && items[headerIndex].type === 'header') {
          (items[headerIndex] as ListItem & { type: 'header' }).total = monthTotal;
        }
        currentMonth = monthKey;
        monthTotal = 0;
        headerIndex = items.length;
        items.push({
          type: 'header',
          title: monthKey,
          key: `header-${monthKey}`,
          total: 0,
        });
      }
      monthTotal += tx.type === 'expense' ? -tx.amount : tx.type === 'income' ? tx.amount : 0;
      items.push({ type: 'transaction', data: tx, key: tx.id });
    }
    if (headerIndex >= 0 && items[headerIndex].type === 'header') {
      (items[headerIndex] as ListItem & { type: 'header' }).total = monthTotal;
    }
    return items;
  }, [transactions]);

  const activeFilterCount = [
    filterType,
    filterCat,
    filterAcc,
    quickDate !== 'all' ? quickDate : undefined,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterType(undefined);
    setFilterCat(undefined);
    setFilterAcc(undefined);
    setQuickDate('all');
  };

  const handleApplyFilters = useCallback((filters: AppliedFilters) => {
    setFilterType(filters.type ?? undefined);
    setFilterCat(filters.categoryId ?? undefined);
    setFilterAcc(filters.accountId ?? undefined);
    setQuickDate((filters.quickDate as QuickDateFilter) ?? 'all');
    filterSheetRef.current?.close();
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === 'header') {
        return (
          <View style={styles.monthHeader}>
            <Text style={styles.monthText}>{item.title}</Text>
            <Text
              style={[
                styles.monthTotal,
                { color: item.total >= 0 ? colors.income : colors.expense },
              ]}
            >
              {formatCurrency(item.total, true)}
            </Text>
          </View>
        );
      }
      return (
        <SwipeableTransactionItem
          transaction={item.data}
          onPress={() => setPreviewTx(item.data)}
          onEdit={() => {
            router.push(`/transactions/${item.data.id}?edit=1` as Href);
          }}
          onDelete={() => {
            void (async () => {
              await TransactionService.delete(item.data.id);
              showToast.success('Transaction deleted');
              await loadData(0, true);
            })();
          }}
        />
      );
    },
    [styles, colors, loadData, router],
  );

  const openFilterSheet = useCallback(() => {
    filterSheetRef.current?.snapToIndex(0);
  }, []);

  const unreadNotificationsCount = useAppStore((s) => s.unreadNotificationsCount);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => router.push('/notifications')}
          accessibilityLabel="Notifications"
          accessibilityRole="button"
        >
          <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
          {unreadNotificationsCount > 0 && (
            <View
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
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
      </Animated.View>

      {/* Search */}
      <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.searchWrap}>
        <SearchBar
          placeholder="Search transactions..."
          value={search}
          onChangeText={handleSearchChange}
        />
      </Animated.View>

      {/* Compact Filter Bar */}
      <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.filterBar}>
        {/* Active filter tags (scrollable, shown only when filters active) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.activeTagsRow}
          style={{ flex: 1 }}
        >
          {filterType && (
            <View style={styles.activeTag}>
              <Ionicons name="swap-vertical" size={11} color={colors.primary} />
              <Text style={styles.activeTagText}>
                {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              </Text>
              <TouchableOpacity
                onPress={() => setFilterType(undefined)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="close" size={12} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
          {filterCat && (
            <View style={styles.activeTag}>
              <Ionicons name="pricetag" size={11} color={colors.primary} />
              <Text style={styles.activeTagText}>
                {categories.find((c) => c.id === filterCat)?.name ?? 'Category'}
              </Text>
              <TouchableOpacity
                onPress={() => setFilterCat(undefined)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="close" size={12} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
          {filterAcc && (
            <View style={styles.activeTag}>
              <Ionicons name="wallet" size={11} color={colors.primary} />
              <Text style={styles.activeTagText}>
                {accounts.find((a) => a.id === filterAcc)?.name ?? 'Account'}
              </Text>
              <TouchableOpacity
                onPress={() => setFilterAcc(undefined)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="close" size={12} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
          {quickDate !== 'all' && (
            <View style={styles.activeTag}>
              <Ionicons name="calendar-outline" size={11} color={colors.primary} />
              <Text style={styles.activeTagText}>{QUICK_DATE_LABELS[quickDate] ?? quickDate}</Text>
              <TouchableOpacity
                onPress={() => setQuickDate('all')}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="close" size={12} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Filter button — always visible */}
        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={openFilterSheet}
          accessibilityLabel={`Open filters${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ''}`}
          accessibilityRole="button"
        >
          <Ionicons
            name="options-outline"
            size={15}
            color={activeFilterCount > 0 ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.filterBtnText, activeFilterCount > 0 && { color: colors.primary }]}>
            Filters
          </Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Transaction List */}
      <FlashList<ListItem>
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
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
              <Ionicons name="receipt-outline" size={40} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No transactions found</Text>
            <Text style={styles.emptySubtitle}>
              {activeFilterCount > 0 || search
                ? 'Try adjusting your filters or search'
                : 'Tap + to add your first transaction'}
            </Text>
            {activeFilterCount > 0 && (
              <TouchableOpacity
                style={[
                  styles.emptyCtaBtn,
                  {
                    backgroundColor: colors.bgCard,
                    borderWidth: 1,
                    borderColor: colors.border,
                  },
                ]}
                onPress={clearAllFilters}
              >
                <Text style={[styles.emptyCtaText, { color: colors.primary }]}>Clear Filters</Text>
              </TouchableOpacity>
            )}
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

      {/* Filter Bottom Sheet */}
      <FilterBottomSheet
        ref={filterSheetRef}
        categories={categories}
        accounts={accounts}
        filterType={filterType ?? null}
        filterCat={filterCat ?? null}
        filterAcc={filterAcc ?? null}
        quickDate={quickDate}
        onApply={handleApplyFilters}
      />

      {/* Transaction Preview Sheet */}
      <TransactionPreviewSheet
        transaction={previewTx}
        visible={previewTx !== null}
        onClose={() => setPreviewTx(null)}
        onEdit={(id) => {
          setPreviewTx(null);
          router.push(`/transactions/${id}?edit=1` as Href);
        }}
        onDelete={() => setPreviewTx(null)}
        colors={colors}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
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
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 22,
    },
    title: { ...TYPOGRAPHY.h2, color: colors.textPrimary, fontWeight: '800' },
    searchWrap: { paddingHorizontal: SPACING.md, marginBottom: SPACING.sm },
    /* Compact filter bar */
    filterBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.sm,
      gap: SPACING.sm,
    },
    activeTagsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      paddingRight: SPACING.xs,
    },
    activeTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: RADIUS.full,
      backgroundColor: colors.primary + '15',
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    activeTagText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    filterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: RADIUS.full,
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterBtnActive: {
      borderColor: colors.primary + '40',
      backgroundColor: colors.primary + '10',
    },
    filterBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    filterBadge: {
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    filterBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.heroText,
    },
    monthHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
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
    monthTotal: { fontSize: 12, fontWeight: '700' },
    emptyState: { alignItems: 'center', paddingVertical: 60, gap: SPACING.sm },
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
      textAlign: 'center',
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
    emptyCtaText: { fontSize: 14, fontWeight: '700', color: colors.heroText },
    loadingMore: { alignItems: 'center', paddingVertical: SPACING.md },
    loadingMoreText: { ...TYPOGRAPHY.caption, color: colors.textMuted },
  });
