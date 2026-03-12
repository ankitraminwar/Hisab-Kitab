import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, FAB } from '@/components/common';
import TransactionItem from '@/components/TransactionItem';
import { TransactionService } from '@/services/transactionService';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/utils/constants';
import type {
  Transaction,
  TransactionFilters,
  TransactionType,
} from '@/utils/types';

const TYPE_FILTERS: { key: TransactionType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'expense', label: 'Expenses' },
  { key: 'income', label: 'Income' },
  { key: 'transfer', label: 'Transfers' },
];

const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

export default function TransactionsScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(false);
  const offsetRef = useRef(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [search]);

  const loadTransactions = useCallback(
    async (reset: boolean) => {
      if (loadingRef.current) {
        return;
      }

      loadingRef.current = true;
      setLoading(true);
      try {
        const filters: TransactionFilters = {};
        if (typeFilter !== 'all') {
          filters.type = typeFilter;
        }
        if (debouncedSearch.trim()) {
          filters.search = debouncedSearch.trim();
        }

        const offset = reset ? 0 : offsetRef.current;
        const rows = await TransactionService.getAll(
          filters,
          PAGE_SIZE,
          offset,
        );

        if (reset) {
          setTransactions(rows);
          offsetRef.current = rows.length;
        } else {
          setTransactions((current) => [...current, ...rows]);
          offsetRef.current += rows.length;
        }
        setHasMore(rows.length === PAGE_SIZE);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [debouncedSearch, typeFilter],
  );

  useEffect(() => {
    void loadTransactions(true);
  }, [loadTransactions]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loadingRef.current) {
      void loadTransactions(false);
    }
  }, [hasMore, loadTransactions]);

  const handleDelete = useCallback(
    (transaction: Transaction) => {
      Alert.alert(
        'Delete transaction',
        `Delete ₹${transaction.amount} transaction?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await TransactionService.delete(transaction.id);
              void loadTransactions(true);
            },
          },
        ],
      );
    },
    [loadTransactions],
  );

  const grouped = transactions.reduce<Record<string, Transaction[]>>(
    (accumulator, transaction) => {
      const dateKey = transaction.date.slice(0, 10);
      if (!accumulator[dateKey]) {
        accumulator[dateKey] = [];
      }
      accumulator[dateKey].push(transaction);
      return accumulator;
    },
    {},
  );

  const listData: (string | Transaction)[] = [];
  Object.entries(grouped).forEach(([dateKey, rows]) => {
    listData.push(dateKey);
    listData.push(...rows);
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
        <TouchableOpacity
          onPress={() => router.push('/reports')}
          style={styles.headerButton}
        >
          <Ionicons
            name="bar-chart-outline"
            size={20}
            color={COLORS.textSecondary}
          />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(400).delay(100)}
        style={styles.filters}
      >
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search transactions..."
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons
                name="close-circle"
                size={18}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.filterRow}>
          {TYPE_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterChip,
                typeFilter === filter.key && styles.filterChipActive,
              ]}
              onPress={() => setTypeFilter(filter.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  typeFilter === filter.key && styles.filterChipTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>

      {transactions.length === 0 && !loading ? (
        <Animated.View entering={FadeInRight.duration(500).delay(200)}>
          <EmptyState
            icon="receipt-outline"
            title="No transactions found"
            subtitle="Adjust the filters or add a new transaction."
          />
        </Animated.View>
      ) : (
        <FlashList<string | Transaction>
          data={listData}
          drawDistance={300}
          renderItem={({ item }) =>
            typeof item === 'string' ? (
              <View style={styles.dateHeader}>
                <Text style={styles.dateText}>
                  {format(new Date(item), 'EEEE, d MMMM')}
                </Text>
              </View>
            ) : (
              <TransactionItem
                item={item}
                onPress={() => router.push(`/transactions/${item.id}`)}
                onLongPress={() => handleDelete(item)}
              />
            )
          }
          keyExtractor={(item) =>
            typeof item === 'string' ? `header-${item}` : item.id
          }
          getItemType={(item) => (typeof item === 'string' ? 'header' : 'row')}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.list}
        />
      )}

      <FAB onPress={() => router.push('/transactions/add')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  title: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filters: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    ...TYPOGRAPHY.body,
    paddingVertical: 0,
  },
  filterRow: { flexDirection: 'row', gap: SPACING.sm },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  filterChipTextActive: { color: '#fff' },
  dateHeader: { paddingHorizontal: SPACING.md, paddingVertical: 8 },
  dateText: {
    ...TYPOGRAPHY.label,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  list: { paddingBottom: 120 },
});
