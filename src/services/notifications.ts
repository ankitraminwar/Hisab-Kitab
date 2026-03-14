import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { NotificationPreferences } from '@/utils/types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const DAILY_REMINDER_ID = 'daily-spending-reminder';
const BUDGET_ALERT_ID = 'budget-limit-alert';
const MONTHLY_REPORT_ID = 'monthly-financial-report';

const granted = (status: Notifications.NotificationPermissionsStatus) =>
  status.granted ||
  status.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;

export const initializeNotifications = async () => {
  const permissions = await Notifications.getPermissionsAsync();
  if (granted(permissions)) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return granted(requested);
};

export const cancelManagedNotifications = async () => {
  const notifications = await Notifications.getAllScheduledNotificationsAsync();
  const managedIds = new Set([
    DAILY_REMINDER_ID,
    BUDGET_ALERT_ID,
    MONTHLY_REPORT_ID,
  ]);

  await Promise.all(
    notifications
      .filter((notification) => managedIds.has(notification.identifier))
      .map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.identifier),
      ),
  );
};

export const applyNotificationPreferences = async (
  preferences: NotificationPreferences,
) => {
  const allowed = preferences.enabled ? await initializeNotifications() : false;
  if (!allowed) {
    await cancelManagedNotifications();
    return false;
  }

  await cancelManagedNotifications();

  if (preferences.dailyReminder) {
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_REMINDER_ID,
      content: {
        title: 'Track today’s spending',
        body: 'Review today’s transactions before the day closes.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 20,
        minute: 0,
      },
    });
  }

  if (preferences.budgetAlerts) {
    await Notifications.scheduleNotificationAsync({
      identifier: BUDGET_ALERT_ID,
      content: {
        title: 'Budget check-in',
        body: 'You are approaching one of your monthly budget limits.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 13,
        minute: 0,
      },
    });
  }

  if (preferences.monthlyReportReminder) {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
    nextMonth.setHours(9, 0, 0, 0);

    await Notifications.scheduleNotificationAsync({
      identifier: MONTHLY_REPORT_ID,
      content: {
        title: 'Monthly report ready',
        body: 'Review your monthly finance summary and export your report.',
      },
      trigger:
        Platform.OS === 'android'
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: nextMonth,
            }
          : {
              type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
              day: 1,
              hour: 9,
              minute: 0,
            },
    });
  }

  return true;
};
