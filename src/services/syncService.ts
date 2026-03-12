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
} from '@/database';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/appStore';
import type { SyncQueueItem } from '@/utils/types';

class SyncService {
  private syncing = false;

  private unsubscribe?: () => void;

  start() {
    if (this.unsubscribe) {
      return;
    }

    this.unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      useAppStore.getState().setOnline(isOnline);

      if (isOnline) {
        void this.sync('network-reconnected');
      }
    });
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  async sync(reason = 'manual') {
    if (this.syncing) {
      return;
    }

    const state = await NetInfo.fetch();
    const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
    if (!isOnline) {
      return;
    }

    this.syncing = true;
    useAppStore.getState().setSyncState({ syncInProgress: true, lastSyncError: null });

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
      console.log(`Sync completed: ${reason}`);
    } catch (error) {
      useAppStore.getState().setSyncState({
        syncInProgress: false,
        lastSyncError: error instanceof Error ? error.message : 'Sync failed',
      });
      throw error;
    } finally {
      this.syncing = false;
    }
  }

  private async pushPendingChanges() {
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user?.id ?? null;
    const pendingItems = await listPendingSyncItems();

    for (const item of pendingItems) {
      await this.pushQueueItem(item, userId);
    }
  }

  private async pushQueueItem(item: SyncQueueItem, userId: string | null) {
    try {
      const payload = JSON.parse(item.payload) as Record<string, unknown>;
      const table = item.entity;
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
        if (!remoteRecord || new Date(String(remoteRecord.updatedAt ?? 0)).getTime() <= new Date(deletedAt).getTime()) {
          const { error } = await supabase
            .from(table)
            .upsert({ ...payload, userId, syncStatus: 'synced', lastSyncedAt: deletedAt }, { onConflict: 'id' });
          if (error) {
            throw error;
          }
        }

        await softDeleteLocalRecord(table as never, recordId, deletedAt);
        await removeFromSyncQueue(item.id);
        return;
      }

      const localUpdatedAt = new Date(String(payload.updatedAt)).getTime();
      const remoteUpdatedAt = remoteRecord ? new Date(String(remoteRecord.updatedAt ?? 0)).getTime() : 0;
      if (remoteRecord && remoteUpdatedAt > localUpdatedAt) {
        await upsertLocalRecord(table as never, {
          ...remoteRecord,
          syncStatus: 'synced',
          lastSyncedAt: new Date().toISOString(),
        });
        await removeFromSyncQueue(item.id);
        return;
      }

      const syncedAt = new Date().toISOString();
      const { error } = await supabase.from(table).upsert(
        { ...payload, userId, syncStatus: 'synced', lastSyncedAt: syncedAt },
        { onConflict: 'id' },
      );
      if (error) {
        throw error;
      }

      await markRecordSyncStatus(table as never, recordId, 'synced', syncedAt);
      await removeFromSyncQueue(item.id);
    } catch (error) {
      await incrementSyncRetry(item.id, error instanceof Error ? error.message : 'Push failed');
      throw error;
    }
  }

  private async pullRemoteChanges() {
    const lastSyncAt = await getLastSyncTimestamp();

    for (const table of getSyncableTables()) {
      let query = supabase.from(table).select('*').order('updatedAt', { ascending: true });
      if (lastSyncAt) {
        query = query.gte('updatedAt', lastSyncAt);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      for (const record of data ?? []) {
        if (record.deletedAt) {
          await softDeleteLocalRecord(table, String(record.id), String(record.deletedAt));
          continue;
        }

        const localRows = await fetchTableRows<Record<string, unknown>>(table, 'id = ?', [record.id]);
        const localRecord = localRows[0];
        const remoteUpdatedAt = new Date(String(record.updatedAt)).getTime();
        const localUpdatedAt = localRecord?.updatedAt ? new Date(String(localRecord.updatedAt)).getTime() : 0;

        if (!localRecord || remoteUpdatedAt >= localUpdatedAt) {
          await upsertLocalRecord(table, {
            ...record,
            syncStatus: 'synced',
            lastSyncedAt: new Date().toISOString(),
          });
        }
      }
    }
  }
}

export const syncService = new SyncService();

export const triggerBackgroundSync = async (reason: string) => {
  try {
    await syncService.sync(reason);
  } catch (error) {
    console.warn('Background sync failed', error);
  }
};
