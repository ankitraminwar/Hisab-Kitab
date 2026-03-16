import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Modal,
  Pressable,
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
import { triggerBackgroundSync } from '../../services/syncService';
import { TransactionService } from '../../services/transactionService';
import { useAppStore } from '../../store/appStore';
import {
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  formatCurrency,
} from '../../utils/constants';
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
}> = ({ visible, title, onClose, colors, children }) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    onRequestClose={onClose}
  >
    <Pressable style={filterSheetStyles.overlay} onPress={onClose}>
      <Pressable
        style={[
          filterSheetStyles.sheet,
          { backgroundColor: colors.bgCard, borderColor: colors.border },
        ]}
        onPress={(e) => e.stopPropagation()}
      >
        <View style={filterSheetStyles.handle}>
          <View
            style={[
              filterSheetStyles.handleBar,
              { backgroundColor: colors.textMuted },
            ]}
          />
        </View>
        <View style={filterSheetStyles.sheetHeader}>
          <Text
            style={[
              filterSheetStyles.sheetTitle,
              { color: colors.textPrimary },
            ]}
          >
            {title}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <ScrollView
          style={filterSheetStyles.sheetContent}
          showsVerticalScrollIndicator={false}
        >
          {children}
          <View style={{ height: 32 }} />
        </ScrollView>
      </Pressable>
    </Pressable>
  </Modal>
);

const filterSheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  handle: { alignItems: 'center', paddingTop: 12 },
  handleBar: { width: 40, height: 4, borderRadius: 2, opacity: 0.3 },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 32 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function TransactionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const dataRevision = useAppStore((state) => state.dataRevision);
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
  const [activeFilter, setActiveFilter] = useState<
    'type' | 'category' | 'account' | null
  >(null);

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
          (items[headerIndex] as ListItem & { type: 'header' }).total =
            monthTotal;
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
      monthTotal +=
        tx.type === 'expense'
          ? -tx.amount
          : tx.type === 'income'
            ? tx.amount
            : 0;
      items.push({ type: 'transaction', data: tx, key: tx.id });
    }
    if (headerIndex >= 0 && items[headerIndex].type === 'header') {
      (items[headerIndex] as ListItem & { type: 'header' }).total = monthTotal;
    }
    return items;
  }, [transactions]);

  const activeFilterCount = [filterType, filterCat, filterAcc].filter(
    Boolean,
  ).length;

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
            onPress={() => router.push(`/transactions/${item.data.id}`)}
          />
        </View>
      );
    },
    [styles, colors, router],
  );

  const renderFilterOption = (
    label: string,
    isSelected: boolean,
    onPress: () => void,
    icon?: string,
    iconColor?: string,
  ) => (
    <TouchableOpacity
      key={label}
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
            <Ionicons
              name={icon as never}
              size={18}
              color={iconColor ?? colors.primary}
            />
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
      {isSelected && (
        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => router.push('/notifications')}
        >
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
            <TouchableOpacity
              style={styles.clearChip}
              onPress={clearAllFilters}
            >
              <Ionicons name="close-circle" size={14} color={colors.expense} />
              <Text style={[styles.filterChipText, { color: colors.expense }]}>
                Clear
              </Text>
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
            <Text
              style={[
                styles.filterChipText,
                filterType && { color: colors.primary },
              ]}
            >
              {filterType
                ? filterType.charAt(0).toUpperCase() + filterType.slice(1)
                : 'Type'}
            </Text>
            {filterType ? (
              <TouchableOpacity
                onPress={() => setFilterType(undefined)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="close-circle"
                  size={14}
                  color={colors.primary}
                />
              </TouchableOpacity>
            ) : (
              <Ionicons
                name="chevron-down"
                size={12}
                color={colors.textMuted}
              />
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
            <Text
              style={[
                styles.filterChipText,
                filterCat && { color: colors.primary },
              ]}
            >
              {filterCat
                ? (categories.find((c) => c.id === filterCat)?.name ??
                  'Category')
                : 'Category'}
            </Text>
            {filterCat ? (
              <TouchableOpacity
                onPress={() => setFilterCat(undefined)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="close-circle"
                  size={14}
                  color={colors.primary}
                />
              </TouchableOpacity>
            ) : (
              <Ionicons
                name="chevron-down"
                size={12}
                color={colors.textMuted}
              />
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
            <Text
              style={[
                styles.filterChipText,
                filterAcc && { color: colors.primary },
              ]}
            >
              {filterAcc
                ? (accounts.find((a) => a.id === filterAcc)?.name ?? 'Account')
                : 'Account'}
            </Text>
            {filterAcc ? (
              <TouchableOpacity
                onPress={() => setFilterAcc(undefined)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="close-circle"
                  size={14}
                  color={colors.primary}
                />
              </TouchableOpacity>
            ) : (
              <Ionicons
                name="chevron-down"
                size={12}
                color={colors.textMuted}
              />
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
          ),
        )}
      </FilterSheet>

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
              <Ionicons
                name="receipt-outline"
                size={40}
                color={colors.primary}
              />
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
                <Text style={[styles.emptyCtaText, { color: colors.primary }]}>
                  Clear Filters
                </Text>
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
