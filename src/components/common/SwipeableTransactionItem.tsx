import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { RADIUS, SPACING, TYPOGRAPHY, formatCurrency } from '@/utils/constants';
import type { IoniconsName, Transaction } from '@/utils/types';

interface SwipeableTransactionItemProps {
  transaction: Transaction;
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const SWIPE_THRESHOLD = 80;

export const SwipeableTransactionItem: React.FC<SwipeableTransactionItemProps> = React.memo(
  ({ transaction, onPress, onEdit, onDelete }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const translateX = useSharedValue(0);

    const isExpense = transaction.type === 'expense';
    const isIncome = transaction.type === 'income';
    const amountColor = isIncome ? colors.income : isExpense ? colors.expense : colors.textPrimary;
    const amountPrefix = isIncome ? '+' : isExpense ? '-' : '';

    const triggerHaptic = () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const panGesture = Gesture.Pan()
      .activeOffsetX([-15, 15])
      .onUpdate((event) => {
        // Only allow left swipe (negative)
        if (event.translationX < 0) {
          translateX.value = Math.max(event.translationX, -160);
        }
      })
      .onEnd((event) => {
        if (event.translationX < -SWIPE_THRESHOLD) {
          translateX.value = withSpring(-160, { damping: 15, stiffness: 150 });
          runOnJS(triggerHaptic)();
        } else {
          translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
        }
      });

    const tapGesture = Gesture.Tap().onEnd(() => {
      if (translateX.value < -10) {
        translateX.value = withSpring(0);
      } else {
        runOnJS(onPress)();
      }
    });

    const composedGesture = Gesture.Race(panGesture, tapGesture);

    const itemStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }],
    }));

    const actionsStyle = useAnimatedStyle(() => ({
      opacity: translateX.value < -20 ? withTiming(1) : withTiming(0),
    }));

    const categoryIcon = (transaction.categoryIcon || 'receipt-outline') as IoniconsName;
    const categoryColor = transaction.categoryColor || colors.primary;

    return (
      <View style={styles.wrapper}>
        {/* Swipe actions behind */}
        <Animated.View style={[styles.actions, actionsStyle]}>
          {onEdit && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.7}
              accessibilityLabel="Edit transaction"
              accessibilityRole="button"
              onPress={() => {
                translateX.value = withSpring(0);
                onEdit();
              }}
            >
              <Ionicons name="pencil" size={20} color={colors.heroText} />
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.expense }]}
              activeOpacity={0.7}
              accessibilityLabel="Delete transaction"
              accessibilityRole="button"
              onPress={() => {
                translateX.value = withSpring(0);
                onDelete();
              }}
            >
              <Ionicons name="trash" size={20} color={colors.heroText} />
              <Text style={styles.actionText}>Delete</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Main content */}
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.container, itemStyle]}>
            {/* Category icon */}
            <View style={[styles.iconBg, { backgroundColor: categoryColor + '15' }]}>
              <Ionicons name={categoryIcon} size={20} color={categoryColor} />
            </View>

            {/* Info */}
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {transaction.categoryName || 'Uncategorized'}
              </Text>
              <Text style={styles.detail} numberOfLines={1}>
                {transaction.notes || transaction.merchant || transaction.paymentMethod || ''}
              </Text>
            </View>

            {/* Amount */}
            <View style={styles.amountWrap}>
              <Text style={[styles.amount, { color: amountColor }]}>
                {amountPrefix}
                {formatCurrency(transaction.amount)}
              </Text>
              <Text style={styles.date}>
                {new Date(transaction.date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })}
              </Text>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    );
  },
);

SwipeableTransactionItem.displayName = 'SwipeableTransactionItem';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      position: 'relative',
      marginBottom: SPACING.sm,
      borderRadius: RADIUS.lg,
      overflow: 'hidden',
    },
    actions: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    actionBtn: {
      width: 80,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    actionText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#fff',
    },
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.md,
      gap: SPACING.md,
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconBg: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: {
      flex: 1,
      gap: 2,
    },
    name: {
      ...TYPOGRAPHY.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    detail: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      fontSize: 12,
    },
    amountWrap: {
      alignItems: 'flex-end',
      gap: 2,
    },
    amount: {
      ...TYPOGRAPHY.bodyMedium,
      fontWeight: '700',
      fontSize: 15,
    },
    date: {
      ...TYPOGRAPHY.caption,
      color: colors.textMuted,
      fontSize: 11,
    },
  });
}
