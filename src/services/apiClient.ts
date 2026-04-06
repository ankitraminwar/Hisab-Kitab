import { logger } from '../utils/logger';
import { supabase } from '../lib/supabase';
import { isSupabaseConfigured } from '../lib/env';

type SupabaseResult<T> = { data: T; error: null } | { data: null; error: string };

/**
 * Centralised API client wrapper around Supabase calls.
 * Handles: Supabase availability check, auth token refresh on 401, error normalisation.
 * All Supabase data calls should go through this wrapper.
 */
export const apiClient = {
  /**
   * Execute a Supabase query builder and normalise the result.
   * Automatically handles 401 by signing out.
   */
  async query<T>(
    tag: string,
    queryFn: () => Promise<{ data: T | null; error: { message: string; code?: string } | null }>,
  ): Promise<SupabaseResult<T>> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Supabase is not configured' };
    }

    try {
      const result = await queryFn();

      if (result.error) {
        // Handle auth errors — force sign out on 401-equivalent
        if (result.error.code === 'PGRST301' || result.error.message?.includes('JWT')) {
          logger.warn(tag, 'Auth token invalid, signing out');
          await supabase.auth.signOut();
          return { data: null, error: 'Session expired. Please sign in again.' };
        }

        logger.warn(tag, 'Supabase query error', result.error.message);
        return { data: null, error: result.error.message };
      }

      return { data: result.data as T, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(tag, 'Unexpected error in Supabase call', message);
      return { data: null, error: message };
    }
  },

  /**
   * Call a Supabase RPC function with normalised error handling.
   */
  async rpc<T>(
    tag: string,
    fnName: string,
    params?: Record<string, unknown>,
  ): Promise<SupabaseResult<T>> {
    return this.query<T>(tag, async () => {
      const { data, error } = await supabase.rpc(fnName, params);
      return { data: data as T | null, error };
    });
  },
} as const;
