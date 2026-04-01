import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { RADIUS, SPACING, TYPOGRAPHY, formatCompact } from '@/utils/constants';
import type { CategoryBreakdown } from '@/utils/types';

interface DonutChartProps {
  data: CategoryBreakdown[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  size = 180,
  strokeWidth = 24,
  centerLabel,
  centerValue,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumulativePercent = 0;

  return (
    <View style={styles.container}>
      <View style={styles.chartWrap}>
        <Svg width={size} height={size}>
          {/* Background ring */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={colors.bgElevated}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Data slices */}
          <G rotation="-90" origin={`${center}, ${center}`}>
            {data.map((item) => {
              const percent = item.percentage / 100;
              const strokeDasharray = `${circumference * percent} ${circumference * (1 - percent)}`;
              const offset = circumference * cumulativePercent;
              cumulativePercent += percent;

              return (
                <Circle
                  key={item.categoryId}
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={item.categoryColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                  fill="none"
                />
              );
            })}
          </G>
        </Svg>
        {/* Center text */}
        {(centerLabel || centerValue) && (
          <View style={[styles.center, { width: size, height: size }]}>
            {centerLabel && <Text style={styles.centerLabel}>{centerLabel}</Text>}
            {centerValue && (
              <Text style={styles.centerValue} numberOfLines={1} adjustsFontSizeToFit>
                {centerValue}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Legend — shows category name, amount, and percentage */}
      <View style={styles.legend}>
        {data.slice(0, 6).map((item, index) => (
          <Animated.View
            key={item.categoryId}
            entering={FadeInDown.delay(index * 50).duration(300)}
            style={styles.legendItem}
          >
            <View style={[styles.legendDot, { backgroundColor: item.categoryColor }]} />
            <View style={styles.legendTextWrap}>
              <Text style={styles.legendText} numberOfLines={1}>
                {item.categoryName}
              </Text>
              <Text style={styles.legendAmount}>{formatCompact(item.amount)}</Text>
            </View>
            <View style={[styles.legendBadge, { backgroundColor: item.categoryColor + '18' }]}>
              <Text style={[styles.legendPercent, { color: item.categoryColor }]}>
                {item.percentage.toFixed(0)}%
              </Text>
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      gap: SPACING.lg,
      width: '100%',
    },
    chartWrap: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    center: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerLabel: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    centerValue: {
      ...TYPOGRAPHY.h2,
      color: colors.textPrimary,
      fontWeight: '800',
      marginTop: 2,
      maxWidth: 100,
    },
    legend: {
      alignSelf: 'stretch',
      gap: SPACING.xs,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingVertical: 6,
      paddingHorizontal: SPACING.sm,
      borderRadius: RADIUS.sm,
      backgroundColor: colors.bgElevated + '60',
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendTextWrap: {
      flex: 1,
      gap: 1,
    },
    legendText: {
      ...TYPOGRAPHY.caption,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    legendAmount: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '500',
    },
    legendBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: RADIUS.full,
    },
    legendPercent: {
      fontSize: 11,
      fontWeight: '700',
    },
  });
}
