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
import {
  mapLocalToRemoteRecord,
  mapRemoteToLocalRecord,
} from '@/services/syncTransform';
import { useAppStore } from '@/store/appStore';
import type { SyncableTable } from '@/utils/constants';
import type { SyncQueueItem } from '@/utils/types';

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

  async sync(reason = 'manual') {
    if (this.syncing) {
      return;
    }

    const state = await NetInfo.fetch();
    const isOnline = Boolean(
      state.isConnected && state.isInternetReachable !== false,
    );
    if (!isOnline) {
      return;
    }
    if (!this.remoteSchemaAvailable) {
      return;
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
      console.log(`Sync completed: ${reason}`);
    } catch (error) {
      if (this.isRemoteSchemaMissing(error)) {
        this.remoteSchemaAvailable = false;
        useAppStore.getState().setSyncState({
          syncInProgress: false,
          lastSyncError:
            'Supabase schema is not deployed yet. Apply supabase/schema.sql and restart sync.',
        });
        return;
      }

      useAppStore.getState().setSyncState({
        syncInProgress: false,
        lastSyncError: error instanceof Error ? error.message : 'Sync failed',
      });
      throw error;
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
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'PGRST205'
    );
  }

  private async pushPendingChanges() {
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user?.id ?? null;
    if (!userId) {
      return;
    }
    const pendingItems = await listPendingSyncItems();

    for (const item of pendingItems) {
      await this.pushQueueItem(item, userId);
    }
  }

  private async pushQueueItem(item: SyncQueueItem, userId: string | null) {
    try {
      const payload = JSON.parse(item.payload) as Record<string, unknown>;
      const table = item.entity as SyncableTable;
      const remotePayload = mapLocalToRemoteRecord(table, payload);
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
              ...remotePayload,
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
          ...remotePayload,
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
      await incrementSyncRetry(
        item.id,
        error instanceof Error ? error.message : 'Push failed',
      );
      throw error;
    }
  }

  private async pullRemoteChanges() {
    const session = await supabase.auth.getSession();
    if (!session.data.session?.user?.id) {
      return;
    }

    const lastSyncAt = await getLastSyncTimestamp();

    for (const table of getSyncableTables()) {
      let query = supabase
        .from(table)
        .select('*')
        .order('updated_at', { ascending: true });
      if (lastSyncAt) {
        query = query.gte('updated_at', lastSyncAt);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
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
        }
      }
    }
  }
}

export const syncService = new SyncService();

export const triggerBackgroundSync = async (reason: string) => {
  await syncService.requestSync(reason);
};
