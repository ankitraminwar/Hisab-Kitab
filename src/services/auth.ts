import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { isSupabaseConfigured } from '../lib/env';
import { supabase } from '../lib/supabase';
import type { AuthCredentials } from '../utils/types';

const PIN_KEY = 'hisabkitab.pin';
const BIOMETRIC_KEY = 'hisabkitab.biometrics';
const BIOMETRIC_PROMPT_KEY = 'hisabkitab.biometrics.prompted';
const SUPABASE_CONFIG_ERROR_MESSAGE =
  'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then rebuild or restart the app so app.config.js can expose them.';

type AuthOperationResult = {
  error: Error | null;
};

const normalizeAuthError = (error: unknown, fallbackMessage: string): Error => {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (
      !message ||
      message.toLowerCase().includes('network request failed') ||
      message.toLowerCase().includes('failed to fetch') ||
      message.toLowerCase().includes('fetch')
    ) {
      return new Error('Could not reach the server. Check your internet connection and try again.');
    }
    return error;
  }

  return new Error(fallbackMessage);
};

const runAuthOperation = async (
  operationName: string,
  operation: () => Promise<unknown>,
): Promise<AuthOperationResult> => {
  if (!isSupabaseConfigured) {
    return { error: new Error(SUPABASE_CONFIG_ERROR_MESSAGE) };
  }

  try {
    await operation();
    return { error: null };
  } catch (error) {
    return {
      error: normalizeAuthError(error, `${operationName} failed unexpectedly.`),
    };
  }
};

export const setPin = async (pin: string): Promise<void> => {
  await SecureStore.setItemAsync(PIN_KEY, pin, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
};

export const getPin = async (): Promise<string | null> => SecureStore.getItemAsync(PIN_KEY);

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

export const setBiometricPrompted = async (prompted: boolean): Promise<void> => {
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
    runAuthOperation('Sign up', () => supabase.auth.signUp({ email, password })),
  signIn: async ({ email, password }: AuthCredentials) =>
    runAuthOperation('Sign in', () => supabase.auth.signInWithPassword({ email, password })),
  signInWithOtp: async (email: string) =>
    runAuthOperation('Sign in with OTP', () => supabase.auth.signInWithOtp({ email })),
  verifyOtp: async (email: string, token: string) =>
    runAuthOperation('Verify OTP', () => supabase.auth.verifyOtp({ email, token, type: 'email' })),
  requestPasswordReset: async (email: string) =>
    runAuthOperation('Request password reset', () =>
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'hisabkitab://reset-password',
      }),
    ),
  resetPassword: async (password: string) =>
    runAuthOperation('Reset password', () =>
      supabase.auth.updateUser({
        password,
      }),
    ),
  signOut: async () => {
    const signOutLocally = () => supabase.auth.signOut({ scope: 'local' });

    try {
      return await supabase.auth.signOut();
    } catch {
      try {
        await signOutLocally();
        return { error: null };
      } catch (localError) {
        return {
          error: normalizeAuthError(localError, 'Sign out failed unexpectedly'),
        };
      }
    }
  },
  getSession: async () => {
    if (!isSupabaseConfigured) {
      return {
        data: { session: null },
        error: new Error(SUPABASE_CONFIG_ERROR_MESSAGE),
      };
    }

    try {
      return await supabase.auth.getSession();
    } catch (error) {
      return {
        data: { session: null },
        error: normalizeAuthError(error, 'Failed to retrieve auth session'),
      };
    }
  },
  onAuthStateChange: (callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]) =>
    supabase.auth.onAuthStateChange(callback),
};
