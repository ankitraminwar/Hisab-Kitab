import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '../../components/common';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { BudgetService, GoalService } from '../../services/dataService';
import { useAppStore } from '../../store/appStore';
import { RADIUS, SPACING, TYPOGRAPHY, formatCurrency } from '../../utils/constants';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'alert' | 'info' | 'success';
  time: string;
  isRead: boolean;
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dataRevision = useAppStore((s) => s.dataRevision);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const buildNotifications = useCallback(async () => {
    const items: NotificationItem[] = [];
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Budget-based notifications
    const budgets = await BudgetService.getForMonth(year, month);
    for (const b of budgets) {
      if (b.limit_amount <= 0) continue;
      const pct = b.spent / b.limit_amount;
      if (pct >= 1) {
        items.push({
          id: `budget-over-${b.id}`,
          title: 'Budget Exceeded',
          message: `You have exceeded your ${b.categoryName ?? 'budget'} limit by ${formatCurrency(b.spent - b.limit_amount)}.`,
          type: 'alert',
          time: 'This month',
          isRead: false,
        });
      } else if (pct >= 0.8) {
        items.push({
          id: `budget-warn-${b.id}`,
          title: 'Budget Warning',
          message: `${b.categoryName ?? 'Budget'} is ${Math.round(pct * 100)}% used. ${formatCurrency(b.limit_amount - b.spent)} remaining.`,
          type: 'alert',
          time: 'This month',
          isRead: false,
        });
      }
    }

    // Goal-based notifications
    const goals = await GoalService.getAll();
    for (const g of goals) {
      if (g.currentAmount >= g.targetAmount) {
        items.push({
          id: `goal-done-${g.id}`,
          title: 'Goal Achieved!',
          message: `Congratulations! You have reached your savings goal for "${g.name}".`,
          type: 'success',
          time: 'Recently',
          isRead: true,
        });
      } else if (g.targetAmount > 0 && g.currentAmount / g.targetAmount >= 0.75) {
        items.push({
          id: `goal-near-${g.id}`,
          title: 'Almost There!',
          message: `"${g.name}" is ${Math.round((g.currentAmount / g.targetAmount) * 100)}% funded. Keep it up!`,
          type: 'info',
          time: 'Recently',
          isRead: true,
        });
      }
    }

    // Monthly report reminder (always show on 1st of month)
    if (now.getDate() <= 3) {
      items.push({
        id: 'monthly-report',
        title: 'Monthly Report Ready',
        message:
          'Your financial report for last month is now available. Review your spending patterns.',
        type: 'info',
        time: 'Today',
        isRead: false,
      });
    }

    setNotifications(items);
  }, []);

  useEffect(() => {
    void buildNotifications();
  }, [buildNotifications, dataRevision]);

  const getIconForType = (type: NotificationItem['type']) => {
    switch (type) {
      case 'alert':
        return 'warning';
      case 'success':
        return 'checkmark-circle';
      case 'info':
      default:
        return 'information-circle';
    }
  };

  const getColorForType = (type: NotificationItem['type']) => {
    switch (type) {
      case 'alert':
        return colors.expense;
      case 'success':
        return colors.income;
      case 'info':
      default:
        return colors.primary;
    }
  };

  const renderItem = ({ item, index }: { item: NotificationItem; index: number }) => {
    const iconColor = getColorForType(item.type);

    return (
      <Animated.View entering={FadeInDown.duration(400).delay(index * 100)}>
        <TouchableOpacity style={[styles.notificationCard, !item.isRead && styles.unreadCard]}>
          <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
            <Ionicons name={getIconForType(item.type)} size={24} color={iconColor} />
          </View>
          <View style={styles.contentContainer}>
            <Text style={[styles.title, !item.isRead && styles.unreadText]}>{item.title}</Text>
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.time}>{item.time}</Text>
          </View>
          {!item.isRead && <View style={styles.unreadDot} />}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Notifications" />

      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-off-outline"
            title="No Notifications"
            subtitle="You're all caught up! Check back later."
          />
        }
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
    listContent: {
      padding: SPACING.md,
      paddingBottom: 100,
      flexGrow: 1,
    },
    notificationCard: {
      flexDirection: 'row',
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    unreadCard: {
      borderColor: colors.primary + '50',
      backgroundColor: colors.bgElevated,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: SPACING.md,
    },
    contentContainer: {
      flex: 1,
    },
    title: {
      ...TYPOGRAPHY.body,
      color: colors.textPrimary,
      fontWeight: '600',
      marginBottom: 2,
    },
    unreadText: {
      fontWeight: '800',
      color: colors.textPrimary,
    },
    message: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 6,
      lineHeight: 18,
    },
    time: {
      fontSize: 11,
      color: colors.textMuted,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginLeft: SPACING.sm,
    },
  });
