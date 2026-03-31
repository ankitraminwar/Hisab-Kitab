import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { format } from 'date-fns';
import { useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AmountText, Button, CustomModal, SearchBar } from '../../components/common';
import TransactionItem from '../../components/TransactionItem';
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

// ─── Filter Bottom Sheet ──────────────────────────────────────────────────────
const FilterSheet: React.FC<{
  visible: boolean;
  title: string;
  onClose: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  children: React.ReactNode;
}> = ({ visible, title, onClose, children }) => (
  <CustomModal visible={visible} title={title} onClose={onClose}>
    <ScrollView showsVerticalScrollIndicator={false} style={{ paddingBottom: 32 }}>
      {children}
    </ScrollView>
  </CustomModal>
);

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
  const [activeFilter, setActiveFilter] = useState<'type' | 'category' | 'account' | null>(null);

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

  const buildFilters = useCallback(
    () => ({
      type: filterType,
      categoryId: filterCat,
      accountId: filterAcc,
      search: debouncedSearch.trim() || undefined,
    }),
    [filterType, filterCat, filterAcc, debouncedSearch],
  );

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

  const activeFilterCount = [filterType, filterCat, filterAcc].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterType(undefined);
    setFilterCat(undefined);
    setFilterAcc(undefined);
  };

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
        <View style={styles.txCardWrapper}>
          <TransactionItem
            item={item.data}
            onPress={() => setPreviewTx(item.data)}
            onLongPress={() => setPreviewTx(item.data)}
          />
        </View>
      );
    },
    [styles, colors],
  );

  const renderFilterOption = (
    label: string,
    isSelected: boolean,
    onPress: () => void,
    icon?: string,
    iconColor?: string,
    id?: string,
  ) => (
    <TouchableOpacity
      key={id ?? label}
      style={[styles.filterOption, isSelected && styles.filterOptionActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.filterOptionLeft}>
        {icon && (
          <View
            style={[
              styles.filterOptionIcon,
              { backgroundColor: (iconColor ?? colors.primary) + '15' },
            ]}
          >
            <Ionicons name={icon as never} size={18} color={iconColor ?? colors.primary} />
          </View>
        )}
        <Text
          style={[
            styles.filterOptionText,
            isSelected && { color: colors.primary, fontWeight: '700' },
          ]}
        >
          {label}
        </Text>
      </View>
      {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
    </TouchableOpacity>
  );

  const unreadNotificationsCount = useAppStore((s) => s.unreadNotificationsCount);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
        <TouchableOpacity style={styles.menuBtn} onPress={() => router.push('/notifications')}>
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

      {/* Filter Chips */}
      <Animated.View entering={FadeInDown.duration(400).delay(150)}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {activeFilterCount > 0 && (
            <TouchableOpacity style={styles.clearChip} onPress={clearAllFilters}>
              <Ionicons name="close-circle" size={14} color={colors.expense} />
              <Text style={[styles.filterChipText, { color: colors.expense }]}>Clear</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.filterChip, filterType && styles.filterChipActive]}
            onPress={() => setActiveFilter('type')}
          >
            <Ionicons
              name="swap-vertical"
              size={13}
              color={filterType ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.filterChipText, filterType && { color: colors.primary }]}>
              {filterType ? filterType?.charAt(0)?.toUpperCase() + filterType?.slice(1) : 'Type'}
            </Text>
            {filterType ? (
              <TouchableOpacity
                onPress={() => setFilterType(undefined)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={14} color={colors.primary} />
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterCat && styles.filterChipActive]}
            onPress={() => setActiveFilter('category')}
          >
            <Ionicons
              name="pricetag"
              size={13}
              color={filterCat ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.filterChipText, filterCat && { color: colors.primary }]}>
              {filterCat
                ? (categories.find((c) => c.id === filterCat)?.name ?? 'Category')
                : 'Category'}
            </Text>
            {filterCat ? (
              <TouchableOpacity
                onPress={() => setFilterCat(undefined)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={14} color={colors.primary} />
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterAcc && styles.filterChipActive]}
            onPress={() => setActiveFilter('account')}
          >
            <Ionicons
              name="wallet"
              size={13}
              color={filterAcc ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.filterChipText, filterAcc && { color: colors.primary }]}>
              {filterAcc
                ? (accounts.find((a) => a.id === filterAcc)?.name ?? 'Account')
                : 'Account'}
            </Text>
            {filterAcc ? (
              <TouchableOpacity
                onPress={() => setFilterAcc(undefined)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={14} color={colors.primary} />
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
            )}
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      {/* Type Filter Sheet */}
      <FilterSheet
        visible={activeFilter === 'type'}
        title="Transaction Type"
        onClose={() => setActiveFilter(null)}
        colors={colors}
      >
        {renderFilterOption(
          'All Types',
          !filterType,
          () => {
            setFilterType(undefined);
            setActiveFilter(null);
          },
          'list',
          colors.textSecondary,
        )}
        {renderFilterOption(
          'Expense',
          filterType === 'expense',
          () => {
            setFilterType('expense');
            setActiveFilter(null);
          },
          'arrow-up-circle',
          colors.expense,
        )}
        {renderFilterOption(
          'Income',
          filterType === 'income',
          () => {
            setFilterType('income');
            setActiveFilter(null);
          },
          'arrow-down-circle',
          colors.income,
        )}
        {renderFilterOption(
          'Transfer',
          filterType === 'transfer',
          () => {
            setFilterType('transfer');
            setActiveFilter(null);
          },
          'swap-horizontal-outline',
          colors.transfer,
        )}
      </FilterSheet>

      {/* Category Filter Sheet */}
      <FilterSheet
        visible={activeFilter === 'category'}
        title="Category"
        onClose={() => setActiveFilter(null)}
        colors={colors}
      >
        {renderFilterOption(
          'All Categories',
          !filterCat,
          () => {
            setFilterCat(undefined);
            setActiveFilter(null);
          },
          'grid',
          colors.textSecondary,
        )}
        {categories.map((c) =>
          renderFilterOption(
            c.name,
            filterCat === c.id,
            () => {
              setFilterCat(c.id);
              setActiveFilter(null);
            },
            c.icon,
            c.color,
            c.id,
          ),
        )}
      </FilterSheet>

      {/* Account Filter Sheet */}
      <FilterSheet
        visible={activeFilter === 'account'}
        title="Account"
        onClose={() => setActiveFilter(null)}
        colors={colors}
      >
        {renderFilterOption(
          'All Accounts',
          !filterAcc,
          () => {
            setFilterAcc(undefined);
            setActiveFilter(null);
          },
          'wallet',
          colors.textSecondary,
        )}
        {accounts.map((a) =>
          renderFilterOption(
            a.name,
            filterAcc === a.id,
            () => {
              setFilterAcc(a.id);
              setActiveFilter(null);
            },
            a.icon,
            a.color,
            a.id,
          ),
        )}
      </FilterSheet>

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
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
    },
    title: { ...TYPOGRAPHY.h2, color: colors.textPrimary, fontWeight: '800' },
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
    clearChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: RADIUS.xl,
      backgroundColor: colors.expense + '10',
      borderWidth: 1,
      borderColor: colors.expense + '20',
    },
    filterOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    filterOptionActive: {
      backgroundColor: colors.primary + '08',
      marginHorizontal: -4,
      paddingHorizontal: 8,
      borderRadius: RADIUS.sm,
    },
    filterOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    filterOptionIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterOptionText: {
      ...TYPOGRAPHY.body,
      color: colors.textPrimary,
      fontWeight: '500',
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
    txCardWrapper: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: SPACING.sm,
      overflow: 'hidden',
    },
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
    emptyCtaText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    loadingMore: { alignItems: 'center', paddingVertical: SPACING.md },
    loadingMoreText: { ...TYPOGRAPHY.caption, color: colors.textMuted },
  });
