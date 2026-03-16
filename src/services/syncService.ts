import NetInfo from '@react-native-community/netinfo';

import {
  fetchTableRows,
  getLastSyncTimestamp,
  getSyncableTables,
  incrementSyncRetry,
  listPendingSyncItems,
  markRecordSyncStatus,
  removeFromSyncQueue,
  setLastSyncTimestamp,
  softDeleteLocalRecord,
  upsertLocalRecord,
} from '../database';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import type { SyncableTable } from '../utils/constants';
import type { SyncQueueItem } from '../utils/types';
import {
  mapLocalToRemoteRecord,
  mapRemoteToLocalRecord,
} from './syncTransform';

/** Extract a readable message from any thrown value (including Supabase PostgrestError). */
const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return String(error);
};

const MAX_RETRY_DELAY_MS = 60_000;
const BASE_DELAY_MS = 1_000;

const backoffDelay = (retryCount: number): number => {
  const exponential = Math.min(
    BASE_DELAY_MS * Math.pow(2, retryCount),
    MAX_RETRY_DELAY_MS,
  );
  const jitter = Math.random() * exponential * 0.3;
  return exponential + jitter;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

class SyncService {
  private syncing = false;
  private remoteSchemaAvailable = true;

  private unsubscribe?: () => void;

  start() {
    if (this.unsubscribe) {
      return;
    }

    this.unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(
        state.isConnected && state.isInternetReachable !== false,
      );
      useAppStore.getState().setOnline(isOnline);

      if (isOnline) {
        void this.requestSync('network-reconnected');
      }
    });
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  resetSchemaFlag() {
    this.remoteSchemaAvailable = true;
  }

  async sync(reason = 'manual'): Promise<{ success: boolean; error?: string }> {
    if (this.syncing) {
      return { success: false, error: 'Sync already in progress' };
    }

    const state = await NetInfo.fetch();
    const isOnline = Boolean(
      state.isConnected && state.isInternetReachable !== false,
    );
    if (!isOnline) {
      return { success: false, error: 'Device is offline' };
    }

    if (reason === 'manual') {
      this.remoteSchemaAvailable = true;
    }

    if (!this.remoteSchemaAvailable) {
      return {
        success: false,
        error:
          'Supabase schema is not deployed yet. Apply supabase/schema.sql and retry.',
      };
    }

    this.syncing = true;
    useAppStore
      .getState()
      .setSyncState({ syncInProgress: true, lastSyncError: null });

    try {
      await this.pushPendingChanges();
      await this.pullRemoteChanges();

      const completedAt = new Date().toISOString();
      await setLastSyncTimestamp(completedAt);
      useAppStore.getState().setSyncState({
        syncInProgress: false,
        lastSyncAt: completedAt,
        lastSyncError: null,
      });
      return { success: true };
    } catch (error) {
      if (this.isRemoteSchemaMissing(error)) {
        this.remoteSchemaAvailable = false;
        const message =
          'Supabase schema is not deployed yet. Apply supabase/schema.sql and restart sync.';
        useAppStore.getState().setSyncState({
          syncInProgress: false,
          lastSyncError: message,
        });
        return { success: false, error: message };
      }

      const message = errorMessage(error) || 'Sync failed';
      useAppStore.getState().setSyncState({
        syncInProgress: false,
        lastSyncError: message,
      });
      return { success: false, error: message };
    } finally {
      this.syncing = false;
    }
  }

  async requestSync(reason = 'manual') {
    try {
      await this.sync(reason);
    } catch (error) {
      console.warn('Background sync failed', error);
    }
  }

  private isRemoteSchemaMissing(error: unknown) {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    if ('code' in error && error.code === 'PGRST205') {
      return true;
    }

    if ('message' in error) {
      const message = String((error as { message: string }).message);
      return message.includes('schema cache') || message.includes('PGRST');
    }

    return false;
  }

  /**
   * Tables ordered by FK dependency: parents before children.
   * Categories & accounts must exist before transactions reference them, etc.
   */
  private static readonly TABLE_PUSH_ORDER: Record<string, number> = {
    user_profile: 0,
    accounts: 0,
    categories: 0,
    payment_methods: 0,
    goals: 0,
    assets: 0,
    liabilities: 0,
    net_worth_history: 1,
    transactions: 1,
    budgets: 1,
    split_expenses: 2,
    split_members: 3,
  };

  private async pushPendingChanges() {
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user?.id ?? null;
    if (!userId) {
      return;
    }
    const pendingItems = await listPendingSyncItems();

    // Sort by FK dependency order so parent rows are pushed before children
    pendingItems.sort((a, b) => {
      const orderA = SyncService.TABLE_PUSH_ORDER[a.entity] ?? 1;
      const orderB = SyncService.TABLE_PUSH_ORDER[b.entity] ?? 1;
      return orderA - orderB;
    });

    const failures: { item: SyncQueueItem; reason: string }[] = [];

    for (const item of pendingItems) {
      try {
        await this.pushQueueItem(item, userId);
      } catch (error) {
        const reason = errorMessage(error);
        failures.push({ item, reason });
        console.warn(
          `Sync push failed for ${item.entity}/${item.recordId}:`,
          reason,
        );

        if (item.retryCount >= 2) {
          await sleep(backoffDelay(item.retryCount));
        }
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `Failed to sync ${failures.length} record(s): ${failures
          .slice(0, 3)
          .map((failure) => `${failure.item.entity}/${failure.item.recordId}`)
          .join(', ')}`,
      );
    }
  }

  private async pushQueueItem(item: SyncQueueItem, userId: string | null) {
    try {
      const payload = JSON.parse(item.payload) as Record<string, unknown>;
      const table = item.entity as SyncableTable;
      const remoteData = mapLocalToRemoteRecord(
        item.entity as SyncableTable,
        payload,
      );
      const recordId = String(payload.id ?? item.recordId);

      const { data: remoteRecord, error: remoteError } = await supabase
        .from(table)
        .select('*')
        .eq('id', recordId)
        .maybeSingle();

      if (remoteError) {
        throw remoteError;
      }

      if (item.operation === 'delete') {
        const deletedAt = String(payload.deletedAt ?? new Date().toISOString());
        if (
          !remoteRecord ||
          new Date(String(remoteRecord.updated_at ?? 0)).getTime() <=
            new Date(deletedAt).getTime()
        ) {
          const { error } = await supabase.from(table).upsert(
            {
              ...remoteData,
              user_id: userId,
              sync_status: 'synced',
              last_synced_at: deletedAt,
            },
            { onConflict: 'id' },
          );
          if (error) {
            throw error;
          }
        }

        await softDeleteLocalRecord(table as never, recordId, deletedAt);
        await removeFromSyncQueue(item.id);
        return;
      }

      const localUpdatedAt = new Date(String(payload.updatedAt)).getTime();
      const remoteUpdatedAt = remoteRecord
        ? new Date(String(remoteRecord.updated_at ?? 0)).getTime()
        : 0;
      if (remoteRecord && remoteUpdatedAt > localUpdatedAt) {
        await upsertLocalRecord(table, {
          ...mapRemoteToLocalRecord(
            table,
            remoteRecord as Record<string, unknown>,
          ),
          syncStatus: 'synced',
          lastSyncedAt: new Date().toISOString(),
        });
        await removeFromSyncQueue(item.id);
        return;
      }

      const syncedAt = new Date().toISOString();
      const { error } = await supabase.from(table).upsert(
        {
          ...remoteData,
          user_id: userId,
          sync_status: 'synced',
          last_synced_at: syncedAt,
        },
        { onConflict: 'id' },
      );
      if (error) {
        throw error;
      }

      await markRecordSyncStatus(table as never, recordId, 'synced', syncedAt);
      await removeFromSyncQueue(item.id);
    } catch (error) {
      await incrementSyncRetry(item.id, errorMessage(error) || 'Push failed');
      throw error;
    }
  }

  private async pullRemoteChanges() {
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user?.id;
    if (!userId) {
      return;
    }

    const lastSyncAt = await getLastSyncTimestamp();
    let changed = false;

    for (const table of getSyncableTables()) {
      let query = supabase
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: true });
      if (lastSyncAt) {
        query = query.gte('updated_at', lastSyncAt);
      }

      const { data, error } = await query;
      if (error) {
        if (this.isRemoteSchemaMissing(error)) {
          throw error;
        }
        console.warn(`Pull failed for table ${table}:`, error.message);
        continue;
      }

      for (const record of data ?? []) {
        const localRecordData = mapRemoteToLocalRecord(
          table,
          record as Record<string, unknown>,
        );

        if (localRecordData.deletedAt) {
          await softDeleteLocalRecord(
            table,
            String(localRecordData.id),
            String(localRecordData.deletedAt),
          );
          changed = true;
          continue;
        }

        const localRows = await fetchTableRows<Record<string, unknown>>(
          table,
          'id = ?',
          [String(localRecordData.id)],
        );
        const localRecord = localRows[0];
        const remoteUpdatedAt = new Date(
          String(localRecordData.updatedAt),
        ).getTime();
        const localUpdatedAt = localRecord?.updatedAt
          ? new Date(String(localRecord.updatedAt)).getTime()
          : 0;

        if (!localRecord || remoteUpdatedAt >= localUpdatedAt) {
          await upsertLocalRecord(table, {
            ...localRecordData,
            syncStatus: 'synced',
            lastSyncedAt: new Date().toISOString(),
          });
          changed = true;
        }
      }
    }

    if (changed) {
      useAppStore.getState().bumpDataRevision();
    }
  }
}

export const syncService = new SyncService();

export const triggerBackgroundSync = async (reason: string) => {
  await syncService.requestSync(reason);
};
