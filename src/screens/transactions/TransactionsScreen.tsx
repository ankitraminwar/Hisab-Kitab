import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../../utils/constants';
import { TransactionService } from '../../services/transactionService';
import { Transaction, TransactionFilters, TransactionType } from '../../utils/types';
import { SearchBar, FAB, EmptyState } from '../../components/common';
import TransactionItem from '../../components/TransactionItem';
import { format } from 'date-fns';

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
  const PAGE_SIZE = 30;

  const loadTransactions = useCallback(async (reset = true) => {
    if (loading) return;
    setLoading(true);
    const offset = reset ? 0 : page * PAGE_SIZE;
    const filters: TransactionFilters = {};
    if (typeFilter !== 'all') filters.type = typeFilter;
    if (search.length > 0) filters.search = search;

    const data = await TransactionService.getAll(filters, PAGE_SIZE, offset);
    if (reset) {
      setTransactions(data);
      setPage(1);
    } else {
      setTransactions(prev => [...prev, ...data]);
      setPage(p => p + 1);
    }
    setHasMore(data.length === PAGE_SIZE);
    setLoading(false);
  }, [search, typeFilter, page, loading]);

  useEffect(() => { loadTransactions(true); }, [search, typeFilter]);

  const handleDelete = (tx: Transaction) => {
    Alert.alert('Delete Transaction', `Delete ₹${tx.amount} transaction?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await TransactionService.delete(tx.id);
          loadTransactions(true);
        }
      }
    ]);
  };

  // Group transactions by date
  const grouped = transactions.reduce((acc, tx) => {
    const dateKey = tx.date.slice(0, 10);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(tx);
    return acc;
  }, {} as Record<string, Transaction[]>);

  const listData: (string | Transaction)[] = [];
  Object.entries(grouped).forEach(([date, txs]) => {
    listData.push(date);
    listData.push(...txs);
  });

  const renderItem = ({ item }: { item: string | Transaction }) => {
    if (typeof item === 'string') {
      return (
        <View style={styles.dateHeader}>
          <Text style={styles.dateText}>
            {format(new Date(item), 'EEEE, d MMMM')}
          </Text>
        </View>
      );
    }
    return (
      <TransactionItem
        item={item}
        onPress={() => router.push(`/transactions/${item.id}`)}
        onLongPress={() => handleDelete(item)}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
        <TouchableOpacity onPress={() => router.push('/reports')} style={styles.headerBtn}>
          <Ionicons name="bar-chart-outline" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search transactions..." />
        <View style={styles.typeFilters}>
          {TYPE_FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, typeFilter === f.key && styles.filterChipActive]}
              onPress={() => setTypeFilter(f.key as any)}
            >
              <Text style={[styles.filterChipText, typeFilter === f.key && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {transactions.length === 0 && !loading ? (
        <EmptyState
          icon="receipt-outline"
          title="No transactions found"
          subtitle="Try adjusting your search or filters"
        />
      ) : (
        <FlashList
          data={listData}
          renderItem={renderItem}
          keyExtractor={(item) => typeof item === 'string' ? `header-${item}` : item.id}
          estimatedItemSize={64}
          getItemType={(item) => typeof item === 'string' ? 'header' : 'row'}
          onEndReached={() => { if (hasMore) loadTransactions(false); }}
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
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filters: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  typeFilters: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
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
  filterChipTextActive: {
    color: '#fff',
  },
  dateHeader: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  dateText: {
    ...TYPOGRAPHY.label,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  list: { paddingBottom: 120 },
});
