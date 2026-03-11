import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const PIN_KEY = "trackBuddyPin";

export const setPin = async (pin: string): Promise<void> => {
  await SecureStore.setItemAsync(PIN_KEY, pin, {
    keychainAccessible: SecureStore.ALWAYS_THIS_DEVICE_ONLY,
  });
};

export const getPin = async (): Promise<string | null> => {
  return SecureStore.getItemAsync(PIN_KEY);
};

export const removePin = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(PIN_KEY);
};

export const authenticateBiometric = async (): Promise<boolean> => {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!hasHardware || !isEnrolled) return false;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock TrackBuddy",
    fallbackLabel: "Enter PIN",
    disableDeviceFallback: false,
  });
  return result.success;
};
