import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { RADIUS, SPACING } from '../../utils/constants';

const Bone: React.FC<{
  width: number | string;
  height: number;
  borderRadius?: number;
}> = ({ width, height, borderRadius = RADIUS.sm }) => {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        animStyle,
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: colors.border,
        },
      ]}
    />
  );
};

/** Skeleton placeholder matching TransactionItem layout */
export const SkeletonTransactionItem: React.FC = () => {
  const { colors } = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <Bone width={40} height={40} borderRadius={RADIUS.md} />
      <View style={styles.body}>
        <Bone width={120} height={14} />
        <Bone width={80} height={12} />
      </View>
      <Bone width={60} height={16} />
    </View>
  );
};

/** Render a list of skeleton items */
export const SkeletonList: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <View style={styles.list}>
    {Array.from({ length: count }, (_, i) => (
      <SkeletonTransactionItem key={i} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  body: {
    flex: 1,
    gap: 6,
  },
  list: {
    gap: SPACING.xs,
  },
});
