import Constants from 'expo-constants';
import { logger } from '../utils/logger';

type AppPublicEnv = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

type AppExtraConfig = {
  publicEnv?: AppPublicEnv;
};

const sanitizeEnvValue = (value: string | undefined | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const isValidHttpUrl = (value: string | undefined) =>
  value ? /^https?:\/\/\S+$/i.test(value) : false;

const extra = (Constants.expoConfig?.extra ?? {}) as AppExtraConfig;

const rawEnv = {
  supabaseUrl: sanitizeEnvValue(extra.publicEnv?.supabaseUrl),
  supabaseAnonKey: sanitizeEnvValue(extra.publicEnv?.supabaseAnonKey),
};

const requiredEnv = {
  supabaseUrl: isValidHttpUrl(rawEnv.supabaseUrl) ? rawEnv.supabaseUrl : undefined,
  supabaseAnonKey: rawEnv.supabaseAnonKey,
};

const configIssues: string[] = [];

if (!rawEnv.supabaseUrl) {
  configIssues.push('expo.extra.publicEnv.supabaseUrl is missing');
} else if (!isValidHttpUrl(rawEnv.supabaseUrl)) {
  configIssues.push('expo.extra.publicEnv.supabaseUrl must start with http:// or https://');
}

if (!rawEnv.supabaseAnonKey) {
  configIssues.push('expo.extra.publicEnv.supabaseAnonKey is missing');
}

if (configIssues.length > 0) {
  logger.error(
    'Env',
    `Supabase runtime config is misconfigured: ${configIssues.join(
      '; ',
    )}. Check app.config.js and the EXPO_PUBLIC_SUPABASE_* values it reads.`,
  );
}

const FALLBACK_SUPABASE_URL = 'https://invalid.local';
const FALLBACK_SUPABASE_ANON_KEY = 'invalid-anon-key';

export const isSupabaseConfigured =
  Boolean(requiredEnv.supabaseUrl) && Boolean(requiredEnv.supabaseAnonKey);

export const env = {
  // Keep runtime stable in preview/dev builds even when runtime config is absent.
  supabaseUrl: requiredEnv.supabaseUrl ?? FALLBACK_SUPABASE_URL,
  supabaseAnonKey: requiredEnv.supabaseAnonKey ?? FALLBACK_SUPABASE_ANON_KEY,
};
