import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, CustomPopup, EmptyState, ProgressBar } from '@/components/common';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { exportService } from '@/services/exportService';
import { logger } from '@/utils/logger';
import {
  buildReportDocumentData,
  formatReportAmount,
  type ReportDocumentData,
  type ReportExportInput,
  type ReportPeriod,
} from '@/services/reportExportService';
import { useAppStore } from '@/store/appStore';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/utils/constants';

type ExportKind = 'pdf' | 'csv' | 'json';

const LOGO_SOURCE = require('../../../assets/images/icon.png');

const parseInput = (params: {
  from?: string | string[];
  to?: string | string[];
  label?: string | string[];
  period?: string | string[];
}): ReportExportInput | null => {
  const from = typeof params.from === 'string' ? params.from : undefined;
  const to = typeof params.to === 'string' ? params.to : undefined;
  const label = typeof params.label === 'string' ? params.label : undefined;
  const periodValue = typeof params.period === 'string' ? params.period : undefined;

  if (!from || !to || !label) {
    return null;
  }

  const period: ReportPeriod =
    periodValue === 'weekly' || periodValue === 'yearly' ? periodValue : 'monthly';

  return {
    from,
    to,
    label,
    period,
  };
};

const monthDay = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso || '—'
    : d.toLocaleDateString('en-IN', { month: 'short', day: '2-digit' });
};

export default function MonthlyReportPreviewScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dataRevision = useAppStore((state) => state.dataRevision);
  const params = useLocalSearchParams<{
    from?: string;
    to?: string;
    label?: string;
    period?: string;
    focus?: string;
  }>();
  const fromParam = typeof params.from === 'string' ? params.from : undefined;
  const toParam = typeof params.to === 'string' ? params.to : undefined;
  const labelParam = typeof params.label === 'string' ? params.label : undefined;
  const periodParam = typeof params.period === 'string' ? params.period : undefined;
  const focusParam = typeof params.focus === 'string' ? params.focus : undefined;

  const reportInput = useMemo(
    () =>
      parseInput({
        from: fromParam,
        to: toParam,
        label: labelParam,
        period: periodParam,
      }),
    [fromParam, toParam, labelParam, periodParam],
  );
  const preferredExport: ExportKind = focusParam === 'csv' ? 'csv' : 'pdf';

  const [report, setReport] = useState<ReportDocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [popupConfig, setPopupConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const loadReport = useCallback(async () => {
    if (!reportInput) {
      setLoading(false);
      setPopupConfig({
        visible: true,
        title: 'Missing Report Range',
        message: 'This preview link is missing report dates. Please reopen it from Reports.',
        type: 'error',
      });
      return;
    }

    setLoading(true);
    try {
      const nextReport = await buildReportDocumentData(reportInput);
      setReport(nextReport);
    } catch (error) {
      logger.warn('ReportPreview', 'Failed to load report preview', error);
      setPopupConfig({
        visible: true,
        title: 'Preview Failed',
        message: 'Could not build the report preview. Please try again.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [reportInput]);

  useEffect(() => {
    void loadReport();
  }, [loadReport, dataRevision]);

  const handleExport = async (kind: ExportKind) => {
    if (kind !== 'json' && (!reportInput || !report)) {
      return;
    }

    setExporting(kind);
    try {
      if (kind === 'json') {
        await exportService.exportFullBackupJson();
      } else if (kind === 'pdf') {
        await exportService.exportTransactionsPdf(reportInput ?? undefined, {
          reportData: report ?? undefined,
          isDark,
        });
      } else {
        await exportService.exportTransactionsCsv(reportInput ?? undefined, report ?? undefined);
      }

      setPopupConfig({
        visible: true,
        title: kind === 'json' ? 'Backup Ready' : 'Export Ready',
        message:
          kind === 'json'
            ? 'Full JSON backup was exported successfully.'
            : `${kind.toUpperCase()} report was prepared successfully.`,
        type: 'success',
      });
    } catch (error) {
      logger.warn('ReportPreview', `Failed to export ${kind} report`, error);
      setPopupConfig({
        visible: true,
        title: 'Export Failed',
        message: `Could not export the ${kind.toUpperCase()} report.`,
        type: 'error',
      });
    } finally {
      setExporting(null);
    }
  };

  const summaryCards = report
    ? [
        {
          label: 'Total Balance',
          value: formatReportAmount(report.totalBalance),
          helper: 'Available across accounts',
          accent: colors.primary,
        },
        {
          label: 'Income',
          value: formatReportAmount(report.income),
          helper: report.incomeTrend?.label ?? 'No prior comparison',
          accent: colors.income,
        },
        {
          label: 'Expenses',
          value: formatReportAmount(report.expense),
          helper: report.expenseTrend?.label ?? 'No prior comparison',
          accent: colors.expense,
        },
        {
          label: 'Savings',
          value: formatReportAmount(report.savings),
          helper: `${report.savingsRate.toFixed(0)}% saving rate`,
          accent: report.savings >= 0 ? colors.income : colors.expense,
        },
      ]
    : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Report Preview"
        rightAction={{
          icon: 'close-outline',
          onPress: () => router.back(),
        }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(350)} style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.brandRow}>
              <Image source={LOGO_SOURCE} style={styles.logo} resizeMode="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>Personal Finance Report</Text>
                <Text style={styles.brandName}>Hisab Kitab</Text>
              </View>
            </View>
            <View
              style={[
                styles.focusChip,
                {
                  backgroundColor:
                    preferredExport === 'pdf' ? colors.primary + '18' : colors.income + '18',
                },
              ]}
            >
              <Text
                style={[
                  styles.focusChipText,
                  {
                    color: preferredExport === 'pdf' ? colors.primary : colors.income,
                  },
                ]}
              >
                {preferredExport === 'pdf' ? 'PDF Preview' : 'CSV Preview'}
              </Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>
            {reportInput?.label ?? 'Monthly'} Financial Statement
          </Text>
          <Text style={styles.heroSubtitle}>
            {reportInput ? `${reportInput.from} to ${reportInput.to}` : 'Preparing report range'}
          </Text>
          <Text style={styles.heroDescription}>
            This preview is the source for the exported file, including summary, budgets, spending
            categories, and the full transaction ledger in one place.
          </Text>

          <View style={styles.actionRow}>
            <Button
              title="Export PDF"
              icon="document-text-outline"
              onPress={() => void handleExport('pdf')}
              loading={exporting === 'pdf'}
              style={styles.primaryAction}
            />
            <Button
              title="Export CSV"
              icon="download-outline"
              onPress={() => void handleExport('csv')}
              loading={exporting === 'csv'}
              variant="secondary"
              style={styles.secondaryAction}
            />
          </View>
          <Button
            title="Export JSON Backup"
            icon="archive-outline"
            onPress={() => void handleExport('json')}
            loading={exporting === 'json'}
            variant="ghost"
            style={styles.backupAction}
          />
        </Animated.View>

        {loading ? (
          <View style={styles.loadingCard}>
            <Text style={styles.loadingTitle}>Building your report preview...</Text>
            <Text style={styles.loadingSubtext}>
              Gathering transactions, budgets, and monthly totals.
            </Text>
          </View>
        ) : !report ? (
          <View style={styles.emptyWrapper}>
            <EmptyState
              icon="document-text-outline"
              title="Report preview unavailable"
              subtitle="Please reopen the export flow from the Reports screen."
              action="Go Back"
              onAction={() => router.back()}
            />
          </View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(350).delay(60)} style={styles.summaryGrid}>
              {summaryCards.map((card) => (
                <View
                  key={card.label}
                  style={[
                    styles.summaryCard,
                    {
                      borderColor: card.accent + '22',
                      backgroundColor: card.accent + (isDark ? '10' : '0D'),
                    },
                  ]}
                >
                  <Text style={styles.summaryLabel}>{card.label}</Text>
                  <Text style={[styles.summaryValue, { color: card.accent }]}>{card.value}</Text>
                  <Text style={styles.summaryHelper}>{card.helper}</Text>
                </View>
              ))}
            </Animated.View>

            <Animated.View
              entering={FadeInDown.duration(350).delay(110)}
              style={styles.sectionCard}
            >
              <View style={styles.sectionHeader}>
                <View
                  style={[
                    styles.sectionIconWrap,
                    { backgroundColor: colors.primary + '16', marginTop: 2 },
                  ]}
                >
                  <Ionicons name="pie-chart-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.sectionLead}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>Budget Performance</Text>
                  </View>
                  <Text style={styles.sectionSubtitle}>
                    Category budgets and actual spend for this report period.
                  </Text>
                </View>
              </View>

              {report.budgets.length === 0 ? (
                <View style={styles.emptySection}>
                  <Text style={styles.emptySectionText}>
                    No budgets created for this period yet.
                  </Text>
                </View>
              ) : (
                report.budgets.map((budget) => {
                  const statusColor =
                    budget.statusTone === 'danger'
                      ? colors.expense
                      : budget.statusTone === 'warn'
                        ? colors.warning
                        : colors.income;

                  return (
                    <View key={budget.id} style={styles.budgetRow}>
                      <View style={styles.budgetTopRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.budgetCategory}>
                            {budget.categoryName ?? 'Budget'}
                          </Text>
                          <Text style={styles.budgetMeta}>
                            Budget {formatReportAmount(budget.limitAmount)} • Spent{' '}
                            {formatReportAmount(budget.spent)}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusPill,
                            {
                              backgroundColor: statusColor + '18',
                              borderColor: statusColor + '30',
                            },
                          ]}
                        >
                          <Text style={[styles.statusText, { color: statusColor }]}>
                            {budget.statusLabel}
                          </Text>
                        </View>
                      </View>
                      <ProgressBar
                        progress={budget.progress}
                        color={statusColor}
                        style={styles.budgetBar}
                      />
                      <Text style={styles.remainingText}>
                        Remaining {formatReportAmount(Math.max(budget.remaining, 0))}
                      </Text>
                    </View>
                  );
                })
              )}
            </Animated.View>

            <Animated.View
              entering={FadeInDown.duration(350).delay(160)}
              style={styles.sectionCard}
            >
              <View style={styles.sectionHeader}>
                <View
                  style={[
                    styles.sectionIconWrap,
                    { backgroundColor: colors.warning + '16', marginTop: 2 },
                  ]}
                >
                  <Ionicons name="sparkles-outline" size={18} color={colors.warning} />
                </View>
                <View style={styles.sectionLead}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>Top Spending Categories</Text>
                  </View>
                  <Text style={styles.sectionSubtitle}>
                    Biggest expense buckets for {report.input.label}.
                  </Text>
                </View>
              </View>

              {report.categoryBreakdown.length === 0 ? (
                <View style={styles.emptySection}>
                  <Text style={styles.emptySectionText}>
                    No expense categories found in this range.
                  </Text>
                </View>
              ) : (
                report.categoryBreakdown.slice(0, 6).map((category) => (
                  <View
                    key={`${category.categoryId}-${category.categoryName}`}
                    style={styles.categoryRow}
                  >
                    <View
                      style={[
                        styles.categoryIconWrap,
                        {
                          backgroundColor: (category.categoryColor || colors.primary) + '18',
                          borderColor: (category.categoryColor || colors.primary) + '30',
                        },
                      ]}
                    >
                      <Ionicons
                        name={(category.categoryIcon || 'ellipse') as never}
                        size={18}
                        color={category.categoryColor || colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.categoryTopRow}>
                        <Text style={styles.categoryName}>{category.categoryName}</Text>
                        <Text style={styles.categoryAmount}>
                          {formatReportAmount(category.total)}
                        </Text>
                      </View>
                      <ProgressBar
                        progress={Math.min(category.percentage / 100, 1)}
                        color={category.categoryColor || colors.primary}
                        style={styles.categoryBar}
                      />
                      <Text style={styles.categoryMeta}>
                        {category.percentage.toFixed(1)}% of expenses
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </Animated.View>

            <Animated.View
              entering={FadeInDown.duration(350).delay(210)}
              style={styles.sectionCard}
            >
              <View style={styles.sectionHeader}>
                <View
                  style={[
                    styles.sectionIconWrap,
                    { backgroundColor: colors.income + '16', marginTop: 2 },
                  ]}
                >
                  <Ionicons name="receipt-outline" size={18} color={colors.income} />
                </View>
                <View style={styles.sectionLead}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>All Transactions</Text>
                    <Text style={styles.transactionCount}>{report.transactions.length} items</Text>
                  </View>
                  <Text style={styles.sectionSubtitle}>
                    Everything included in the export, ordered by latest activity first.
                  </Text>
                </View>
              </View>

              {report.transactions.length === 0 ? (
                <View style={styles.emptySection}>
                  <Text style={styles.emptySectionText}>
                    No transactions found for this period.
                  </Text>
                </View>
              ) : (
                report.transactions.map((transaction) => {
                  const amountColor =
                    transaction.type === 'income'
                      ? colors.income
                      : transaction.type === 'expense'
                        ? colors.expense
                        : colors.primary;

                  return (
                    <View key={transaction.id} style={styles.transactionRow}>
                      <View style={styles.transactionDate}>
                        <Text style={styles.transactionDay}>
                          {monthDay(transaction.date).split(' ')[1]}
                        </Text>
                        <Text style={styles.transactionMonth}>
                          {monthDay(transaction.date).split(' ')[0]}
                        </Text>
                      </View>

                      <View style={styles.transactionBody}>
                        <Text style={styles.transactionTitle}>
                          {transaction.merchant || transaction.categoryName || 'Transaction'}
                        </Text>
                        <Text style={styles.transactionMeta}>
                          {(transaction.categoryName || transaction.type).toString()}
                          {transaction.accountName ? ` • ${transaction.accountName}` : ''}
                          {transaction.paymentMethod ? ` • ${transaction.paymentMethod}` : ''}
                        </Text>
                        {transaction.notes ? (
                          <Text style={styles.transactionNotes} numberOfLines={2}>
                            {transaction.notes}
                          </Text>
                        ) : null}
                      </View>

                      <View style={styles.transactionAmountWrap}>
                        <Text style={[styles.transactionAmount, { color: amountColor }]}>
                          {transaction.type === 'expense'
                            ? '-'
                            : transaction.type === 'income'
                              ? '+'
                              : ''}
                          {formatReportAmount(transaction.amount)}
                        </Text>
                        <Text style={styles.transactionType}>{transaction.type.toUpperCase()}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </Animated.View>
          </>
        )}
      </ScrollView>

      <CustomPopup
        visible={popupConfig.visible}
        title={popupConfig.title}
        message={popupConfig.message}
        type={popupConfig.type}
        onClose={() => setPopupConfig((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scroll: {
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.xxl,
      gap: SPACING.md,
    },
    heroCard: {
      backgroundColor: colors.bgCard,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
    },
    heroTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: SPACING.md,
      marginBottom: SPACING.md,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      flex: 1,
    },
    logo: {
      width: 52,
      height: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    eyebrow: {
      ...TYPOGRAPHY.label,
      color: colors.textMuted,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    brandName: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      fontWeight: '800',
      marginTop: 4,
    },
    focusChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: RADIUS.full,
    },
    focusChipText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    heroTitle: {
      ...TYPOGRAPHY.h1,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    heroSubtitle: {
      ...TYPOGRAPHY.body,
      color: colors.textSecondary,
      marginTop: 6,
    },
    heroDescription: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      marginTop: 10,
      lineHeight: 18,
    },
    actionRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginTop: SPACING.lg,
    },
    primaryAction: {
      flex: 1,
    },
    secondaryAction: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backupAction: {
      marginTop: SPACING.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    loadingCard: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.xl,
      alignItems: 'center',
      gap: SPACING.sm,
    },
    loadingTitle: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    loadingSubtext: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      textAlign: 'center',
    },
    emptyWrapper: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: SPACING.md,
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    summaryCard: {
      width: '48.5%',
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      padding: SPACING.md,
      minHeight: 126,
    },
    summaryLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    summaryValue: {
      fontSize: 22,
      fontWeight: '800',
      marginTop: 12,
    },
    summaryHelper: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      marginTop: 8,
      lineHeight: 18,
    },
    sectionCard: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.md,
      marginBottom: SPACING.md,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionLead: {
      flex: 1,
    },
    sectionIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionTextBlock: {
      flex: 1,
    },
    sectionTitle: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    sectionSubtitle: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      marginTop: 4,
      lineHeight: 18,
    },
    sectionMeta: {
      ...TYPOGRAPHY.label,
      color: colors.primary,
      textAlign: 'right',
      maxWidth: 96,
    },
    emptySection: {
      backgroundColor: colors.bgElevated,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      alignItems: 'center',
    },
    emptySectionText: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      textAlign: 'center',
    },
    budgetRow: {
      paddingVertical: SPACING.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    budgetTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    budgetCategory: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    budgetMeta: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      marginTop: 4,
    },
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: RADIUS.full,
      borderWidth: 1,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '800',
    },
    budgetBar: {
      marginTop: 10,
      marginBottom: 8,
    },
    remainingText: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
    },
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginBottom: SPACING.md,
    },
    categoryIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: SPACING.md,
      marginBottom: 8,
    },
    categoryName: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
      flex: 1,
    },
    categoryAmount: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    categoryBar: {
      marginBottom: 6,
    },
    categoryMeta: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
    },
    transactionCount: {
      ...TYPOGRAPHY.label,
      color: colors.primary,
      textAlignVertical: 'center',
    },
    transactionRow: {
      flexDirection: 'row',
      gap: SPACING.md,
      paddingVertical: SPACING.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    transactionDate: {
      width: 56,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingRight: SPACING.sm,
    },
    transactionMonth: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    transactionDay: {
      fontSize: 22,
      fontWeight: '900',
      color: colors.textPrimary,
      marginTop: 1,
    },
    transactionBody: {
      flex: 1,
    },
    transactionTitle: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    transactionMeta: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
      marginTop: 4,
    },
    transactionNotes: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      marginTop: 6,
      lineHeight: 17,
    },
    transactionAmountWrap: {
      alignItems: 'flex-end',
      minWidth: 90,
    },
    transactionAmount: {
      ...TYPOGRAPHY.bodyMedium,
      fontWeight: '800',
    },
    transactionType: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      marginTop: 6,
      fontWeight: '700',
    },
  });
