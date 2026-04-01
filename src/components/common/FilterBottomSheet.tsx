import { Ionicons } from '@expo/vector-icons';
import BottomSheetLib, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import React, { forwardRef, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/utils/constants';
import type { Account, Category, IoniconsName, TransactionType } from '@/utils/types';

interface FilterBottomSheetProps {
  categories: Category[];
  accounts: Account[];
  filterType: TransactionType | null;
  filterCat: string | null;
  filterAcc: string | null;
  quickDate: string;
  onFilterType: (type: TransactionType | null) => void;
  onFilterCat: (catId: string | null) => void;
  onFilterAcc: (accId: string | null) => void;
  onQuickDate: (date: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}

const QUICK_DATES = [
  { id: 'all', label: 'All Time' },
  { id: '7d', label: 'Last 7 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: 'thisYear', label: 'This Year' },
];

const TYPE_OPTIONS: { id: TransactionType; label: string; icon: IoniconsName; color: string }[] = [
  { id: 'expense', label: 'Expense', icon: 'arrow-down-circle', color: '#F43F5E' },
  { id: 'income', label: 'Income', icon: 'arrow-up-circle', color: '#10B981' },
  { id: 'transfer', label: 'Transfer', icon: 'swap-horizontal', color: '#38BDF8' },
];

export const FilterBottomSheet = forwardRef<BottomSheetLib, FilterBottomSheetProps>(
  (
    {
      categories,
      accounts,
      filterType,
      filterCat,
      filterAcc,
      quickDate,
      onFilterType,
      onFilterCat,
      onFilterAcc,
      onQuickDate,
      onClearAll,
      onClose,
    },
    ref,
  ) => {
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={isDark ? 0.6 : 0.35}
        />
      ),
      [isDark],
    );

    const hasActiveFilters = filterType || filterCat || filterAcc || quickDate !== 'all';

    return (
      <BottomSheetLib
        ref={ref}
        index={-1}
        snapPoints={['70%']}
        enablePanDownToClose
        onClose={onClose}
        backdropComponent={renderBackdrop as never}
        backgroundStyle={{ backgroundColor: colors.bgCard }}
        handleIndicatorStyle={{ backgroundColor: colors.textMuted, width: 40 }}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Filters</Text>
          {hasActiveFilters && (
            <Pressable onPress={onClearAll} accessibilityLabel="Clear all filters">
              <Text style={styles.clearText}>Clear All</Text>
            </Pressable>
          )}
        </View>

        <BottomSheetScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Date Range */}
          <Text style={styles.sectionTitle}>Date Range</Text>
          <View style={styles.chipRow}>
            {QUICK_DATES.map((d) => (
              <Pressable
                key={d.id}
                style={[styles.chip, quickDate === d.id && styles.chipActive]}
                onPress={() => onQuickDate(d.id)}
                accessibilityLabel={d.label}
                accessibilityRole="button"
              >
                <Text style={[styles.chipText, quickDate === d.id && { color: colors.heroText }]}>
                  {d.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Type */}
          <Text style={styles.sectionTitle}>Type</Text>
          <View style={styles.chipRow}>
            {TYPE_OPTIONS.map((t) => (
              <Pressable
                key={t.id}
                style={[
                  styles.chip,
                  filterType === t.id && { backgroundColor: t.color, borderColor: t.color },
                ]}
                onPress={() => onFilterType(filterType === t.id ? null : t.id)}
                accessibilityLabel={t.label}
                accessibilityRole="button"
              >
                <Ionicons name={t.icon} size={14} color={filterType === t.id ? '#fff' : t.color} />
                <Text style={[styles.chipText, filterType === t.id && { color: '#fff' }]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Category */}
          <Text style={styles.sectionTitle}>Category</Text>
          <View style={styles.chipRow}>
            {categories
              .filter((c) => !c.deletedAt)
              .slice(0, 20)
              .map((c) => (
                <Pressable
                  key={c.id}
                  style={[
                    styles.chip,
                    filterCat === c.id && { backgroundColor: c.color, borderColor: c.color },
                  ]}
                  onPress={() => onFilterCat(filterCat === c.id ? null : c.id)}
                  accessibilityLabel={c.name}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={(c.icon || 'ellipse') as IoniconsName}
                    size={14}
                    color={filterCat === c.id ? '#fff' : c.color}
                  />
                  <Text style={[styles.chipText, filterCat === c.id && { color: '#fff' }]}>
                    {c.name}
                  </Text>
                </Pressable>
              ))}
          </View>

          {/* Account */}
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.chipRow}>
            {accounts
              .filter((a) => !a.deletedAt)
              .map((a) => (
                <Pressable
                  key={a.id}
                  style={[
                    styles.chip,
                    filterAcc === a.id && {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => onFilterAcc(filterAcc === a.id ? null : a.id)}
                  accessibilityLabel={a.name}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={(a.icon || 'wallet') as IoniconsName}
                    size={14}
                    color={filterAcc === a.id ? '#fff' : colors.textSecondary}
                  />
                  <Text style={[styles.chipText, filterAcc === a.id && { color: '#fff' }]}>
                    {a.name}
                  </Text>
                </Pressable>
              ))}
          </View>

          <View style={{ height: 40 }} />
        </BottomSheetScrollView>
      </BottomSheetLib>
    );
  },
);

FilterBottomSheet.displayName = 'FilterBottomSheet';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    clearText: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.expense,
      fontWeight: '600',
    },
    content: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
    },
    sectionTitle: {
      ...TYPOGRAPHY.label,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: SPACING.lg,
      marginBottom: SPACING.sm,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.xl,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      fontWeight: '600',
    },
  });
}
