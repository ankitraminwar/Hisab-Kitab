import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { supabase } from '@/lib/supabase';
import type { AuthCredentials } from '@/utils/types';

const PIN_KEY = 'hisabkitab.pin';
const BIOMETRIC_KEY = 'hisabkitab.biometrics';
const BIOMETRIC_PROMPT_KEY = 'hisabkitab.biometrics.prompted';

export const setPin = async (pin: string): Promise<void> => {
  await SecureStore.setItemAsync(PIN_KEY, pin, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
};

export const getPin = async (): Promise<string | null> =>
  SecureStore.getItemAsync(PIN_KEY);

export const removePin = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(PIN_KEY);
};

export const setBiometricPreference = async (enabled: boolean) => {
  if (enabled) {
    await SecureStore.setItemAsync(BIOMETRIC_KEY, 'true');
    return;
  }

  await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
};

export const getBiometricPreference = async (): Promise<boolean> => {
  const value = await SecureStore.getItemAsync(BIOMETRIC_KEY);
  return value === 'true';
};

export const setBiometricPrompted = async (
  prompted: boolean,
): Promise<void> => {
  if (prompted) {
    await SecureStore.setItemAsync(BIOMETRIC_PROMPT_KEY, 'true');
    return;
  }

  await SecureStore.deleteItemAsync(BIOMETRIC_PROMPT_KEY);
};

export const getBiometricPrompted = async (): Promise<boolean> => {
  const value = await SecureStore.getItemAsync(BIOMETRIC_PROMPT_KEY);
  return value === 'true';
};

export const authenticateBiometric = async (): Promise<boolean> => {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!hasHardware || !isEnrolled) {
    return false;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Hisab Kitab',
    fallbackLabel: 'Use PIN',
    disableDeviceFallback: false,
  });

  return result.success;
};

export const authService = {
  signUp: async ({ email, password }: AuthCredentials) =>
    supabase.auth.signUp({ email, password }),
  signIn: async ({ email, password }: AuthCredentials) =>
    supabase.auth.signInWithPassword({ email, password }),
  signInWithOtp: async (email: string) =>
    supabase.auth.signInWithOtp({ email }),
  verifyOtp: async (email: string, token: string) =>
    supabase.auth.verifyOtp({ email, token, type: 'email' }),
  requestPasswordReset: async (email: string) =>
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'hisabkitab://reset-password',
    }),
  resetPassword: async (password: string) =>
    supabase.auth.updateUser({
      password,
    }),
  signOut: async () => supabase.auth.signOut(),
  getSession: async () => supabase.auth.getSession(),
  onAuthStateChange: (
    callback: Parameters<typeof supabase.auth.onAuthStateChange>[0],
  ) => supabase.auth.onAuthStateChange(callback),
};
