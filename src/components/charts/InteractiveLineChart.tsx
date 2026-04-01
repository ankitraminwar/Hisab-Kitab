import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-wagmi-charts';

import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { RADIUS, SPACING, TYPOGRAPHY, formatCompact } from '@/utils/constants';
import type { ChartDataPoint } from '@/utils/types';

/**
 * Worklet-safe currency formatter.
 * Intl.NumberFormat is a JS-only API and crashes on the UI thread,
 * so we use plain string math formatted for INR (₹) with Indian grouping.
 */
function formatCurrencyWorklet(value: number): string {
  'worklet';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  // Split integer and decimal parts
  const fixed = abs.toFixed(2);
  const [intPart, decPart] = fixed.split('.');

  // Indian number grouping: last 3 digits, then groups of 2
  let formatted = '';
  const len = intPart.length;
  if (len <= 3) {
    formatted = intPart;
  } else {
    formatted = intPart.substring(len - 3);
    let remaining = intPart.substring(0, len - 3);
    while (remaining.length > 2) {
      formatted = remaining.substring(remaining.length - 2) + ',' + formatted;
      remaining = remaining.substring(0, remaining.length - 2);
    }
    if (remaining.length > 0) {
      formatted = remaining + ',' + formatted;
    }
  }

  // Drop ".00" for cleaner display
  const decimal = decPart === '00' ? '' : '.' + decPart;
  return sign + '\u20B9' + formatted + decimal;
}

interface InteractiveLineChartProps {
  data: ChartDataPoint[];
  title?: string;
  height?: number;
  color?: string;
  showTooltip?: boolean;
}

export const InteractiveLineChart: React.FC<InteractiveLineChartProps> = ({
  data,
  title,
  height = 200,
  color,
  showTooltip = true,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const lineColor = color || colors.primary;

  const stats = useMemo(() => {
    if (data.length === 0) return null;
    const values = data.map((d) => d.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = sum / values.length;
    const first = values[0];
    const last = values[values.length - 1];
    const change = first > 0 ? ((last - first) / first) * 100 : 0;
    return { min, max, avg, change };
  }, [data]);

  // Pad single data point so the line chart can render
  const chartData = useMemo(() => {
    if (data.length === 1) {
      const point = data[0];
      const dayMs = 86_400_000;
      return [{ timestamp: point.timestamp - dayMs, value: 0 }, point];
    }
    return data;
  }, [data]);

  if (data.length === 0) {
    return (
      <View style={[styles.card, { height }]}>
        <Text style={styles.emptyText}>Not enough data to display chart</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {title && (
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {stats && (
            <View
              style={[
                styles.changeBadge,
                {
                  backgroundColor: (stats.change >= 0 ? colors.expense : colors.income) + '15',
                },
              ]}
            >
              <Text
                style={[
                  styles.changeText,
                  {
                    color: stats.change >= 0 ? colors.expense : colors.income,
                  },
                ]}
              >
                {stats.change >= 0 ? '↑' : '↓'} {Math.abs(stats.change).toFixed(1)}%
              </Text>
            </View>
          )}
        </View>
      )}
      <LineChart.Provider data={chartData}>
        <LineChart height={height}>
          <LineChart.Path color={lineColor} width={2.5}>
            <LineChart.Gradient color={lineColor} />
          </LineChart.Path>
          {showTooltip && <LineChart.CursorCrosshair color={lineColor} />}
        </LineChart>
        {showTooltip && (
          <LineChart.PriceText
            format={({ value }) => {
              'worklet';
              return formatCurrencyWorklet(Number(value));
            }}
            style={styles.priceText}
          />
        )}
        {showTooltip && <LineChart.DatetimeText style={styles.dateText} />}
      </LineChart.Provider>

      {/* Stats summary */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Low</Text>
            <Text style={[styles.statValue, { color: colors.income }]}>
              {formatCompact(stats.min)}
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Avg</Text>
            <Text style={styles.statValue}>{formatCompact(stats.avg)}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>High</Text>
            <Text style={[styles.statValue, { color: colors.expense }]}>
              {formatCompact(stats.max)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.md,
    },
    title: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    changeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: RADIUS.full,
    },
    changeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    priceText: {
      ...TYPOGRAPHY.h3,
      color: colors.textPrimary,
      fontWeight: '700',
      marginTop: SPACING.sm,
    },
    dateText: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      marginTop: SPACING.xs,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: SPACING.md,
      paddingTop: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    statLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '500',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    statValue: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    statDivider: {
      width: 1,
      height: 28,
    },
    emptyText: {
      ...TYPOGRAPHY.body,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: SPACING.xl,
    },
  });
}
