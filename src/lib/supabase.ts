import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import 'react-native-url-polyfill/auto';
import { env, isSupabaseConfigured } from './env';
import { logger } from '../utils/logger';

const CHUNK_SIZE = 2000;
const CHUNK_COUNT_SUFFIX = '__chunk_count';

if (!isSupabaseConfigured) {
  logger.warn(
    'Supabase',
    'Runtime config is missing or invalid. Using safe fallback config. Network auth/sync calls will fail until EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set.',
  );
}

/**
 * Chunked SecureStore adapter — splits values > 2 KB across multiple keys
 * so Supabase session tokens don't trigger the SecureStore size warning.
 */
const secureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const countStr = await SecureStore.getItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`);
    if (countStr) {
      const count = parseInt(countStr, 10);
      const chunks: string[] = [];
      for (let i = 0; i < count; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}__chunk_${i}`);
        if (chunk === null) return null;
        chunks.push(chunk);
      }
      return chunks.join('');
    }
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    // Clean up any previous chunks
    await secureStoreAdapter.removeItem(key);

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      return;
    }

    const count = Math.ceil(value.length / CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`, String(count), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(
        `${key}__chunk_${i}`,
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
        { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
      );
    }
  },

  async removeItem(key: string): Promise<void> {
    const countStr = await SecureStore.getItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`);
    if (countStr) {
      const count = parseInt(countStr, 10);
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}__chunk_${i}`);
      }
      await SecureStore.deleteItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`);
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    // React Native apps should manage refresh explicitly based on app focus.
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: false,
    storage: secureStoreAdapter,
  },
});

export const setSupabaseAutoRefreshEnabled = async (enabled: boolean) => {
  try {
    if (!isSupabaseConfigured) {
      await supabase.auth.stopAutoRefresh();
      return;
    }

    if (enabled) {
      await supabase.auth.startAutoRefresh();
      return;
    }

    await supabase.auth.stopAutoRefresh();
  } catch (error) {
    logger.warn('Supabase', 'Failed to update auto-refresh state', error);
  }
};
