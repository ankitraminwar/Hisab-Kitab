import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import React, { memo, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { SPACING, TYPOGRAPHY, formatCurrency } from '../utils/constants';
import type { Transaction } from '../utils/types';

interface TransactionItemProps {
  item: Transaction;
  onPress?: (t: Transaction) => void;
  onLongPress?: (t: Transaction) => void;
}

const SPRING_CONFIG = { damping: 15, stiffness: 200 };

const TransactionItem: React.FC<TransactionItemProps> = ({
  item,
  onPress,
  onLongPress,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    onPress?.(item);
  }, [item, onPress]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(item);
  }, [item, onLongPress]);

  const tapGesture = Gesture.Tap()
    .onBegin(() => {
      scale.value = withSpring(0.97, SPRING_CONFIG);
    })
    .onFinalize(() => {
      scale.value = withSpring(1, SPRING_CONFIG);
    })
    .onEnd(() => {
      if (onPress) {
        handlePress();
      }
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(400)
    .onStart(() => {
      scale.value = withSpring(0.95, SPRING_CONFIG);
      if (onLongPress) {
        handleLongPress();
      }
    })
    .onFinalize(() => {
      scale.value = withSpring(1, SPRING_CONFIG);
    });

  const gesture = Gesture.Exclusive(longPressGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const amountColor =
    item.type === 'income'
      ? colors.income
      : item.type === 'expense'
        ? colors.expense
        : colors.transfer;

  const prefix =
    item.type === 'income' ? '+' : item.type === 'expense' ? '-' : '↔';

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <View
          style={[
            styles.iconBg,
            { backgroundColor: (item.categoryColor || colors.primary) + '1A' },
          ]}
        >
          <Ionicons
            name={(item.categoryIcon || 'receipt-outline') as never}
            size={22}
            color={item.categoryColor || colors.primary}
          />
        </View>

        <View style={styles.details}>
          <Text style={styles.merchant} numberOfLines={1}>
            {item.merchant || item.categoryName || 'Transaction'}
          </Text>
          <View style={styles.meta}>
            <Text style={styles.category}>{item.categoryName}</Text>
            <View style={styles.dot} />
            <Text style={styles.category}>
              {format(new Date(item.date), 'hh:mm a')}
            </Text>
            {item.tags.length > 0 && (
              <>
                <View style={styles.dot} />
                <Text style={styles.tag}>{item.tags[0]}</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.right}>
          <Text style={[styles.amount, { color: amountColor }]}>
            {prefix}
            {formatCurrency(item.amount)}
          </Text>
          <Text style={styles.date}>
            {format(new Date(item.date), 'dd MMM')}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

export default memo(TransactionItem);

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: SPACING.md,
      gap: SPACING.sm,
    },
    iconBg: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    details: {
      flex: 1,
      gap: 3,
    },
    merchant: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    category: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
    },
    dot: {
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.textMuted,
    },
    tag: {
      ...TYPOGRAPHY.caption,
      color: colors.primary,
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4,
    },
    right: {
      alignItems: 'flex-end',
      gap: 3,
    },
    amount: {
      ...TYPOGRAPHY.bodyMedium,
      fontWeight: '700',
    },
    date: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
    },
  });
