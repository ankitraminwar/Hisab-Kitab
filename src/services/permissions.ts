import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';

export interface PermissionStatusSnapshot {
  notifications: boolean;
  biometrics: boolean;
  localStorage: boolean;
}

export const requestInitialPermissions =
  async (): Promise<PermissionStatusSnapshot> => {
    const [notificationPermission, hasBiometricHardware] = await Promise.all([
      Notifications.getPermissionsAsync().then(async (permission) => {
        if (permission.granted) {
          return true;
        }
        const requested = await Notifications.requestPermissionsAsync();
        return requested.granted;
      }),
      LocalAuthentication.hasHardwareAsync(),
    ]);

    return {
      notifications: notificationPermission,
      biometrics: hasBiometricHardware,
      localStorage: true,
    };
  };
