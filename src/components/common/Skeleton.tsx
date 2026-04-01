import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { RADIUS, SPACING } from '@/utils/constants';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = RADIUS.sm,
  style,
}) => {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: colors.bgElevated,
        },
        animatedStyle,
        style,
      ]}
    />
  );
};

export const SkeletonCard: React.FC<{ style?: ViewStyle }> = ({ style }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.card, style]}>
      <View style={styles.cardHeader}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={styles.cardHeaderText}>
          <Skeleton width={120} height={14} />
          <Skeleton width={80} height={10} />
        </View>
        <Skeleton width={60} height={18} />
      </View>
    </View>
  );
};

export const SkeletonTransactionList: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <View style={{ gap: SPACING.sm }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
};

export const SkeletonChart: React.FC = () => {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: 200,
        backgroundColor: colors.bgCard,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: 'flex-end',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm, flex: 1 }}>
        {[0.4, 0.7, 0.5, 0.9, 0.6, 0.3, 0.8].map((h, i) => (
          <Skeleton
            key={i}
            width={24}
            height={120 * h}
            borderRadius={RADIUS.sm}
            style={{ flex: 1 }}
          />
        ))}
      </View>
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
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    cardHeaderText: {
      flex: 1,
      gap: SPACING.xs,
    },
  });
}
