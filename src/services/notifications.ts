import * as Notifications from 'expo-notifications';

export const initNotifications = async () => {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED) {
    return;
  }
  await Notifications.requestPermissionsAsync();
};

export const scheduleNotification = async (
  title: string,
  body: string,
  inSeconds: number,
) => {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: { seconds: inSeconds } as Notifications.NotificationTriggerInput,
  });
};
