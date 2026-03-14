import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ScreenHeader } from '../../components/common/ScreenHeader';
import { EmptyState } from '../../components/common';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { SPACING, RADIUS, TYPOGRAPHY } from '../../utils/constants';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'alert' | 'info' | 'success';
  time: string;
  isRead: boolean;
}

// Mock data for now, could be wired up to a real store later
const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    title: 'Budget Exceeded',
    message: 'You have exceeded your food budget for this month by ₹500.',
    type: 'alert',
    time: '2 hours ago',
    isRead: false,
  },
  {
    id: '2',
    title: 'Monthly Report Ready',
    message: 'Your financial report for last month is now available.',
    type: 'info',
    time: '1 day ago',
    isRead: false,
  },
  {
    id: '3',
    title: 'Goal Achieved!',
    message:
      'Congratulations! You have reached your savings goal for "New Laptop".',
    type: 'success',
    time: '3 days ago',
    isRead: true,
  },
];

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

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

  const renderItem = ({
    item,
    index,
  }: {
    item: NotificationItem;
    index: number;
  }) => {
    const iconColor = getColorForType(item.type);

    return (
      <Animated.View entering={FadeInDown.duration(400).delay(index * 100)}>
        <TouchableOpacity
          style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
        >
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: iconColor + '20' },
            ]}
          >
            <Ionicons
              name={getIconForType(item.type)}
              size={24}
              color={iconColor}
            />
          </View>
          <View style={styles.contentContainer}>
            <Text style={[styles.title, !item.isRead && styles.unreadText]}>
              {item.title}
            </Text>
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
        data={MOCK_NOTIFICATIONS}
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
