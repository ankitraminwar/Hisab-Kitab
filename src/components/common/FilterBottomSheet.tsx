import { Ionicons } from '@expo/vector-icons';
import BottomSheetLib, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import React, { forwardRef, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/utils/constants';
import type { Account, Category, IoniconsName, TransactionType } from '@/utils/types';

export interface AppliedFilters {
  type: TransactionType | null;
  categoryId: string | null;
  accountId: string | null;
  quickDate: string;
}

interface FilterBottomSheetProps {
  categories: Category[];
  accounts: Account[];
  filterType: TransactionType | null;
  filterCat: string | null;
  filterAcc: string | null;
  quickDate: string;
  onApply: (filters: AppliedFilters) => void;
}

const QUICK_DATES: { id: string; label: string; icon: IoniconsName }[] = [
  { id: 'all', label: 'All Time', icon: 'infinite-outline' },
  { id: '7d', label: 'Last 7 Days', icon: 'calendar-outline' },
  { id: 'thisMonth', label: 'This Month', icon: 'today-outline' },
  { id: 'lastMonth', label: 'Last Month', icon: 'time-outline' },
  { id: 'thisYear', label: 'This Year', icon: 'calendar' },
];

const TYPE_OPTIONS: { id: TransactionType; label: string; icon: IoniconsName; color: string }[] = [
  { id: 'expense', label: 'Expense', icon: 'arrow-down-circle', color: '#F43F5E' },
  { id: 'income', label: 'Income', icon: 'arrow-up-circle', color: '#10B981' },
  { id: 'transfer', label: 'Transfer', icon: 'swap-horizontal', color: '#38BDF8' },
];

export const FilterBottomSheet = forwardRef<BottomSheetLib, FilterBottomSheetProps>(
  ({ categories, accounts, filterType, filterCat, filterAcc, quickDate, onApply }, ref) => {
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { bottom: bottomInset } = useSafeAreaInsets();

    // Draft (staged) state — only committed on Apply
    const [draftType, setDraftType] = useState<TransactionType | null>(filterType);
    const [draftCat, setDraftCat] = useState<string | null>(filterCat);
    const [draftAcc, setDraftAcc] = useState<string | null>(filterAcc);
    const [draftDate, setDraftDate] = useState<string>(quickDate);

    // Sync draft from props whenever the sheet opens (index -1 → 0)
    const handleSheetChange = useCallback(
      (index: number) => {
        if (index === 0) {
          setDraftType(filterType);
          setDraftCat(filterCat);
          setDraftAcc(filterAcc);
          setDraftDate(quickDate);
        }
      },
      [filterType, filterCat, filterAcc, quickDate],
    );

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

    const draftCount = [
      draftType,
      draftCat,
      draftAcc,
      draftDate !== 'all' ? draftDate : null,
    ].filter(Boolean).length;

    const handleApply = () => {
      onApply({
        type: draftType,
        categoryId: draftCat,
        accountId: draftAcc,
        quickDate: draftDate,
      });
    };

    const handleReset = () => {
      setDraftType(null);
      setDraftCat(null);
      setDraftAcc(null);
      setDraftDate('all');
    };

    return (
      <BottomSheetLib
        ref={ref}
        index={-1}
        snapPoints={['78%']}
        enablePanDownToClose
        onChange={handleSheetChange}
        backdropComponent={renderBackdrop as never}
        backgroundStyle={{ backgroundColor: colors.bgCard }}
        handleIndicatorStyle={{ backgroundColor: colors.textMuted, width: 40 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={handleReset}
            disabled={draftCount === 0}
            accessibilityLabel="Reset all filters"
            accessibilityRole="button"
            style={styles.headerSideBtn}
          >
            <Text
              style={[
                styles.headerBtn,
                { color: draftCount > 0 ? colors.expense : colors.textMuted },
              ]}
            >
              Reset
            </Text>
          </Pressable>

          <Text style={styles.title}>Filters</Text>

          <Pressable
            onPress={handleApply}
            accessibilityLabel={`Apply${draftCount > 0 ? ` ${draftCount} filter${draftCount > 1 ? 's' : ''}` : ''}`}
            accessibilityRole="button"
            style={[styles.headerSideBtn, styles.applyPill, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.headerBtn, styles.applyPillText]}>
              {draftCount > 0 ? `Apply (${draftCount})` : 'Apply'}
            </Text>
          </Pressable>
        </View>

        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {/* ── Date Range ── */}
          <Text style={styles.sectionTitle}>Date Range</Text>
          <View style={styles.pillRow}>
            {QUICK_DATES.map((d) => {
              const active = draftDate === d.id;
              return (
                <Pressable
                  key={d.id}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => setDraftDate(d.id)}
                  accessibilityLabel={d.label}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={d.icon}
                    size={13}
                    color={active ? colors.heroText : colors.textSecondary}
                  />
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{d.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Type ── */}
          <Text style={styles.sectionTitle}>Type</Text>
          <View style={styles.typeRow}>
            {TYPE_OPTIONS.map((t) => {
              const active = draftType === t.id;
              return (
                <Pressable
                  key={t.id}
                  style={[
                    styles.typeCard,
                    active && { borderColor: t.color, backgroundColor: t.color + '18' },
                  ]}
                  onPress={() => setDraftType(active ? null : t.id)}
                  accessibilityLabel={t.label}
                  accessibilityRole="button"
                >
                  <View
                    style={[
                      styles.typeIconWrap,
                      { backgroundColor: active ? t.color + '22' : colors.bgElevated },
                    ]}
                  >
                    <Ionicons name={t.icon} size={22} color={active ? t.color : colors.textMuted} />
                  </View>
                  <Text style={[styles.typeLabel, active && { color: t.color, fontWeight: '700' }]}>
                    {t.label}
                  </Text>
                  {active && (
                    <View style={[styles.typeCheck, { backgroundColor: t.color }]}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* ── Category ── */}
          {categories.filter((c) => !c.deletedAt).length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Category</Text>
              <View style={styles.chipRow}>
                {categories
                  .filter((c) => !c.deletedAt)
                  .slice(0, 24)
                  .map((c) => {
                    const active = draftCat === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        style={[
                          styles.chip,
                          active && { backgroundColor: c.color, borderColor: c.color },
                        ]}
                        onPress={() => setDraftCat(active ? null : c.id)}
                        accessibilityLabel={c.name}
                        accessibilityRole="button"
                      >
                        <Ionicons
                          name={(c.icon || 'ellipse') as IoniconsName}
                          size={13}
                          color={active ? '#fff' : c.color}
                        />
                        <Text style={[styles.chipText, active && { color: '#fff' }]}>{c.name}</Text>
                      </Pressable>
                    );
                  })}
              </View>
            </>
          )}

          {/* ── Account ── */}
          {accounts.filter((a) => !a.deletedAt).length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Account</Text>
              <View style={styles.chipRow}>
                {accounts
                  .filter((a) => !a.deletedAt)
                  .map((a) => {
                    const active = draftAcc === a.id;
                    return (
                      <Pressable
                        key={a.id}
                        style={[
                          styles.chip,
                          active && {
                            backgroundColor: colors.primary,
                            borderColor: colors.primary,
                          },
                        ]}
                        onPress={() => setDraftAcc(active ? null : a.id)}
                        accessibilityLabel={a.name}
                        accessibilityRole="button"
                      >
                        <Ionicons
                          name={(a.icon || 'wallet') as IoniconsName}
                          size={13}
                          color={active ? '#fff' : colors.textSecondary}
                        />
                        <Text style={[styles.chipText, active && { color: '#fff' }]}>{a.name}</Text>
                      </Pressable>
                    );
                  })}
              </View>
            </>
          )}

          {/* safe-area bottom padding */}
          <View style={{ height: bottomInset + SPACING.lg }} />
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
    },
    headerSideBtn: {
      minWidth: 64,
      alignItems: 'center',
    },
    headerBtn: {
      ...TYPOGRAPHY.bodyMedium,
      fontWeight: '600',
    },
    applyPill: {
      paddingHorizontal: SPACING.md,
      paddingVertical: 6,
      borderRadius: RADIUS.full,
    },
    applyPillText: {
      color: '#fff',
    },
    title: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    content: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.sm,
    },
    sectionTitle: {
      ...TYPOGRAPHY.label,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: SPACING.lg,
      marginBottom: SPACING.sm,
    },
    pillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    pill: {
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
    pillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pillText: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    pillTextActive: {
      color: colors.heroText,
    },
    typeRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    typeCard: {
      flex: 1,
      alignItems: 'center',
      gap: SPACING.sm,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.lg,
      backgroundColor: colors.bgElevated,
      borderWidth: 1.5,
      borderColor: colors.border,
      position: 'relative',
    },
    typeIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeLabel: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    typeCheck: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 16,
      height: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
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
    chipText: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      fontWeight: '600',
    },
  });
}
