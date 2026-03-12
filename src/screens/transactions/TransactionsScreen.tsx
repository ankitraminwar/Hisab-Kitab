import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { format } from 'date-fns';

import { EmptyState, FAB, SearchBar } from '@/components/common';
import TransactionItem from '@/components/TransactionItem';
import { TransactionService } from '@/services/transactionService';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/utils/constants';
import type { Transaction, TransactionFilters, TransactionType } from '@/utils/types';

const TYPE_FILTERS: { key: TransactionType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'expense', label: 'Expenses' },
  { key: 'income', label: 'Income' },
  { key: 'transfer', label: 'Transfers' },
];

export default function TransactionsScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 30;

  const loadTransactions = useCallback(
    async (reset = true) => {
      if (loading) {
        return;
      }

      setLoading(true);
      try {
        const filters: TransactionFilters = {};
        if (typeFilter !== 'all') {
          filters.type = typeFilter;
        }
        if (search.trim()) {
          filters.search = search.trim();
        }

        const offset = reset ? 0 : page * pageSize;
        const rows = await TransactionService.getAll(filters, pageSize, offset);

        setTransactions((current) => (reset ? rows : [...current, ...rows]));
        setPage((current) => (reset ? 1 : current + 1));
        setHasMore(rows.length === pageSize);
      } finally {
        setLoading(false);
      }
    },
    [loading, page, search, typeFilter],
  );

  useEffect(() => {
    void loadTransactions(true);
  }, [loadTransactions]);

  const handleDelete = (transaction: Transaction) => {
    Alert.alert('Delete transaction', `Delete Rs ${transaction.amount} transaction?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await TransactionService.delete(transaction.id);
          void loadTransactions(true);
        },
      },
    ]);
  };

  const grouped = transactions.reduce<Record<string, Transaction[]>>((accumulator, transaction) => {
    const dateKey = transaction.date.slice(0, 10);
    if (!accumulator[dateKey]) {
      accumulator[dateKey] = [];
    }
    accumulator[dateKey].push(transaction);
    return accumulator;
  }, {});

  const listData: (string | Transaction)[] = [];
  Object.entries(grouped).forEach(([dateKey, rows]) => {
    listData.push(dateKey);
    listData.push(...rows);
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
        <TouchableOpacity onPress={() => router.push('/reports')} style={styles.headerButton}>
          <Ionicons name="bar-chart-outline" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search transactions..." />
        <View style={styles.filterRow}>
          {TYPE_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[styles.filterChip, typeFilter === filter.key && styles.filterChipActive]}
              onPress={() => setTypeFilter(filter.key)}
            >
              <Text style={[styles.filterChipText, typeFilter === filter.key && styles.filterChipTextActive]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {transactions.length === 0 && !loading ? (
        <EmptyState icon="receipt-outline" title="No transactions found" subtitle="Adjust the filters or add a new transaction." />
      ) : (
        <FlashList
          data={listData}
          renderItem={({ item }) =>
            typeof item === 'string' ? (
              <View style={styles.dateHeader}>
                <Text style={styles.dateText}>{format(new Date(item), 'EEEE, d MMMM')}</Text>
              </View>
            ) : (
              <TransactionItem
                item={item}
                onPress={() => router.push(`/transactions/${item.id}`)}
                onLongPress={() => handleDelete(item)}
              />
            )
          }
          keyExtractor={(item) => (typeof item === 'string' ? `header-${item}` : item.id)}
          getItemType={(item) => (typeof item === 'string' ? 'header' : 'row')}
          onEndReached={() => {
            if (hasMore) {
              void loadTransactions(false);
            }
          }}
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
  filterChipText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  dateHeader: { paddingHorizontal: SPACING.md, paddingVertical: 8 },
  dateText: { ...TYPOGRAPHY.label, color: COLORS.textMuted, textTransform: 'uppercase' },
  list: { paddingBottom: 120 },
});
