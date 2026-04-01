import NetInfo from '@react-native-community/netinfo';

import {
  enqueueSync,
  fetchLocalRecord,
  fetchTableRows,
  getDatabase,
  getLastSyncTimestamp,
  getSyncableTables,
  getSyncState,
  hasLocalUserData,
  incrementSyncRetry,
  listPendingSyncItems,
  markRecordSyncStatus,
  rebaseLocalRecordId,
  removeFromSyncQueue,
  setLastSyncTimestamp,
  setSyncState,
  softDeleteLocalRecord,
  upsertLocalRecord,
} from '../database';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import type { SyncableTable } from '../utils/constants';
import type { SyncQueueItem, UserProfile } from '../utils/types';
import { mapLocalToRemoteRecord, mapRemoteToLocalRecord } from './syncTransform';

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
  const exponential = Math.min(BASE_DELAY_MS * Math.pow(2, retryCount), MAX_RETRY_DELAY_MS);
  const jitter = Math.random() * exponential * 0.3;
  return exponential + jitter;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

class SyncService {
  private syncing = false;
  private syncStartedAt?: number;
  private syncRequested = false;
  private syncDebounceTimer?: ReturnType<typeof setTimeout>;
  private remoteSchemaAvailable = true;

  private unsubscribe?: () => void;

  start() {
    if (this.unsubscribe) {
      return;
    }

    this.unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      useAppStore.getState().setOnline(isOnline);

      if (isOnline) {
        void this.requestSync('network-reconnected');
      }
    });
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = undefined;
    }
  }

  resetSchemaFlag() {
    this.remoteSchemaAvailable = true;
  }

  async sync(reason = 'manual'): Promise<{ success: boolean; error?: string }> {
    if (this.syncing) {
      return { success: false, error: 'Sync already in progress' };
    }

    const state = await NetInfo.fetch();
    const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
    if (!isOnline) {
      return { success: false, error: 'Device is offline' };
    }

    if (reason === 'manual') {
      this.remoteSchemaAvailable = true;
    }

    if (!this.remoteSchemaAvailable) {
      return {
        success: false,
        error: 'Supabase schema is not deployed yet. Apply supabase/schema.sql and retry.',
      };
    }

    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user?.id ?? null;
    const lastSyncAt = await getLastSyncTimestamp();
    if (userId && (!lastSyncAt || !(await hasLocalUserData(userId)))) {
      const result = await this.initialSync();
      return {
        success: result.success,
        error: result.error,
      };
    }

    this.syncing = true;
    this.syncStartedAt = Date.now();
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
      return { success: true };
    } catch (error) {
      if (this.isRemoteSchemaMissing(error)) {
        this.remoteSchemaAvailable = false;
        const message =
          'Supabase schema is not deployed yet. Apply supabase/schema.sql and restart sync.';
        console.error('Sync failed: Supabase schema mismatch', error);
        useAppStore.getState().setSyncState({
          syncInProgress: false,
          lastSyncError: message,
        });
        return { success: false, error: message };
      }

      const message = errorMessage(error) || 'Sync failed';
      console.error('Sync failed with error:', message, error);
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
    // Sync watchdog: if syncing stuck for >60s, force reset
    if (this.syncing && this.syncStartedAt && Date.now() - this.syncStartedAt > 60000) {
      console.warn('Sync watchdog: forcing reset after 60s');
      this.syncing = false;
    }

    // If a sync is in progress, mark that another is requested
    if (this.syncing) {
      this.syncRequested = true;
      return;
    }

    // Debounce rapid-fire requests
    clearTimeout(this.syncDebounceTimer);
    this.syncDebounceTimer = setTimeout(async () => {
      try {
        await this.sync(reason);
      } catch (error) {
        console.warn('Background sync failed', error);
      }
      // If another sync was requested while this one ran, run it now
      if (this.syncRequested) {
        this.syncRequested = false;
        void this.requestSync('queued');
      }
    }, 500);
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

  private isExpectedDefaultRecordRlsFailure(item: SyncQueueItem, reason: string) {
    const isDefaultCategory = item.entity === 'categories' && item.recordId.startsWith('cat_');
    const isDefaultPaymentMethod =
      item.entity === 'payment_methods' && item.recordId.startsWith('pm_');
    const isDefaultCashAccount = item.entity === 'accounts' && item.recordId === 'acc_cash';
    const isRls =
      reason.includes('row-level security') ||
      reason.includes('42501') ||
      reason.includes('permission denied');
    const isFkConstraint = reason.toLowerCase().includes('foreign key');
    return (
      (isDefaultCategory || isDefaultPaymentMethod || isDefaultCashAccount) &&
      (isRls || isFkConstraint)
    );
  }

  private hydrateUserProfileStore(record: Record<string, unknown>) {
    const profile = record as unknown as UserProfile;
    const store = useAppStore.getState();
    store.setUserProfile(profile);
    store.setTheme(profile.themePreference);
  }

  private async mergeRemoteRecords(
    table: SyncableTable,
    records: Record<string, unknown>[],
    existingLocalById?: Map<string, Record<string, unknown>>,
    compareWithLocal = true,
  ) {
    let changed = false;
    let processedCount = 0;
    const syncedAt = new Date().toISOString();

    for (const record of records) {
      const localRecordData = mapRemoteToLocalRecord(table, record);
      const recordId = String(localRecordData.id);

      if (localRecordData.deletedAt) {
        await softDeleteLocalRecord(table, recordId, String(localRecordData.deletedAt));
        existingLocalById?.delete(recordId);
        changed = true;
        processedCount += 1;
        continue;
      }

      const localRecord = compareWithLocal ? existingLocalById?.get(recordId) : undefined;
      const remoteUpdatedAt = new Date(String(localRecordData.updatedAt)).getTime();
      const localUpdatedAt = localRecord?.updatedAt
        ? new Date(String(localRecord.updatedAt)).getTime()
        : 0;

      if (!compareWithLocal || !localRecord || remoteUpdatedAt >= localUpdatedAt) {
        if (table === 'user_profile') {
          const remoteIsDefault = String(localRecordData.name) === 'Hisab Kitab User';
          const localIsCustom =
            localRecord?.name && String(localRecord.name) !== 'Hisab Kitab User';
          if (remoteIsDefault && localIsCustom) {
            localRecordData.name = localRecord.name;
          }
        }

        const syncedRecord = {
          ...localRecordData,
          syncStatus: 'synced',
          lastSyncedAt: syncedAt,
        };

        await upsertLocalRecord(table, syncedRecord);
        existingLocalById?.set(recordId, syncedRecord);

        if (table === 'user_profile') {
          this.hydrateUserProfileStore(syncedRecord);
        }

        changed = true;
        processedCount += 1;
      }
    }

    return { changed, processedCount };
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
    split_friends: 0,
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

    // One-time: enqueue default categories & payment methods for sync
    await this.ensureDefaultsSynced();

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
        if (!this.isExpectedDefaultRecordRlsFailure(item, reason)) {
          console.warn(`Sync push failed for ${item.entity}/${item.recordId}:`, reason);
        }

        if (item.retryCount >= 2) {
          await sleep(backoffDelay(item.retryCount));
        }
      }
    }

    if (failures.length > 0) {
      // RLS violations on default categories (shared PK across users) are expected
      // on shared devices — skip them so the rest of sync can succeed.
      const critical = failures.filter((f) => {
        const isDefault = f.item.entity === 'categories' && f.item.recordId.startsWith('cat_');
        const isDefaultPm =
          f.item.entity === 'payment_methods' && f.item.recordId.startsWith('pm_');
        const isDefaultCash = f.item.entity === 'accounts' && f.item.recordId === 'acc_cash';
        const isRls =
          f.reason.includes('row-level security') ||
          f.reason.includes('42501') ||
          f.reason.includes('permission denied');
        const isFkConstraint = f.reason.toLowerCase().includes('foreign key');
        if ((isDefault || isDefaultPm || isDefaultCash) && (isRls || isFkConstraint)) {
          markRecordSyncStatus(f.item.entity as SyncableTable, f.item.recordId, 'synced').catch(
            console.warn,
          );
          removeFromSyncQueue(f.item.id).catch(console.warn);
          return false;
        }
        return true;
      });

      if (critical.length > 0) {
        throw new Error(
          `Failed to sync ${critical.length} record(s): ${critical
            .slice(0, 3)
            .map((failure) => `${failure.item.entity}/${failure.item.recordId}`)
            .join(', ')}`,
        );
      }
    }
  }

  private async pushQueueItem(item: SyncQueueItem, userId: string | null) {
    try {
      const table = item.entity as SyncableTable;
      let payload = JSON.parse(item.payload) as Record<string, unknown>;

      // If payload is partial (only id/timestamps, none of the actual record fields),
      // fetch the full row from the local DB so NOT NULL constraints are satisfied.
      // Each entity type has its own required unique field — check all of them to
      // avoid false-positives on tables whose required field isn't in the generic set.
      const isPartialPayload =
        payload.name === undefined && // accounts, categories, goals, split_friends, payment_methods, notes
        payload.amount === undefined && // transactions, recurring_templates
        payload.content === undefined && // notes
        payload.totalAssets === undefined && // net_worth_history
        payload.limitAmount === undefined && // budgets ← key fix: budgets always have limitAmount
        payload.targetAmount === undefined; // goals (also have name, but belt-and-suspenders)
      if (isPartialPayload && item.operation !== 'delete') {
        const fullRecord = await fetchLocalRecord(item.entity, item.recordId);
        if (fullRecord) {
          // fullRecord provides the authoritative base; payload overrides only non-null fields
          // This prevents null payload values (e.g. a stale queue entry) from overwriting valid DB data
          const nonNullPayloadEntries = Object.entries(payload).filter(
            ([, v]) => v !== null && v !== undefined,
          );
          payload = { ...fullRecord, ...Object.fromEntries(nonNullPayloadEntries) };
        }
      }

      const remoteData = mapLocalToRemoteRecord(item.entity as SyncableTable, payload);
      const recordId = String(payload.id ?? item.recordId);

      // tags is stored as a JSON string in SQLite; Supabase expects jsonb (object/array)
      if ('tags' in remoteData && typeof remoteData.tags === 'string') {
        try {
          remoteData.tags = JSON.parse(remoteData.tags as string);
        } catch (error) {
          console.debug('Failed to parse tags JSON, defaulting to empty array', error);
          remoteData.tags = [];
        }
      }

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
        // Only sync soft-delete to Supabase if the record already exists remotely.
        // Use UPDATE (not upsert) so we never trigger an INSERT that requires all NOT NULL columns.
        if (
          remoteRecord &&
          new Date(String(remoteRecord.updated_at ?? 0)).getTime() <= new Date(deletedAt).getTime()
        ) {
          const { error } = await supabase
            .from(table)
            .update({
              deleted_at: deletedAt,
              updated_at: String(payload.updatedAt ?? deletedAt),
              sync_status: 'synced',
              last_synced_at: deletedAt,
            })
            .eq('id', recordId);
          if (error) {
            throw error;
          }
        }

        await softDeleteLocalRecord(table, recordId, deletedAt);
        await removeFromSyncQueue(item.id);
        return;
      }

      const localUpdatedAt = new Date(String(payload.updatedAt)).getTime();
      const remoteUpdatedAt = remoteRecord
        ? new Date(String(remoteRecord.updated_at ?? 0)).getTime()
        : 0;
      if (remoteRecord && remoteUpdatedAt > localUpdatedAt) {
        await upsertLocalRecord(table, {
          ...mapRemoteToLocalRecord(table, remoteRecord as Record<string, unknown>),
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
        // Handle unique constraint violations by adopting the remote ID
        if (error.code === '23505') {
          let conflictQuery = supabase.from(table).select('id').eq('user_id', userId);

          if (table === 'budgets') {
            conflictQuery = conflictQuery
              .eq('category_id', remoteData.category_id)
              .eq('month', remoteData.month)
              .eq('year', remoteData.year);
          } else if (table === 'accounts') {
            conflictQuery = conflictQuery.eq('name', remoteData.name);
          } else if (table === 'categories') {
            conflictQuery = conflictQuery.eq('name', remoteData.name).eq('type', remoteData.type);
          } else {
            throw error; // Not handled for other tables
          }

          const { data: conflictRecord } = await conflictQuery.maybeSingle();
          if (conflictRecord?.id) {
            await rebaseLocalRecordId(table, recordId, conflictRecord.id);
            // Now that we've adopted the remote ID, the next pull will sync it correctly.
            // We can remove it from the queue now as it's been "resolved".
            await removeFromSyncQueue(item.id);
            return;
          }
        }
        throw error;
      }

      const localDb = getDatabase();
      await localDb.execAsync('BEGIN');
      try {
        await markRecordSyncStatus(table, recordId, 'synced', syncedAt);
        await removeFromSyncQueue(item.id);
        await localDb.execAsync('COMMIT');
      } catch (localErr) {
        await localDb.execAsync('ROLLBACK');
        throw localErr;
      }
    } catch (error) {
      const reason = errorMessage(error) || 'Push failed';
      if (this.isExpectedDefaultRecordRlsFailure(item, reason)) {
        await markRecordSyncStatus(item.entity as SyncableTable, item.recordId, 'synced');
        await removeFromSyncQueue(item.id);
        return;
      }

      await incrementSyncRetry(item.id, reason);
      throw error;
    }
  }

  /**
   * One-time step: enqueue all default (non-custom) categories and payment
   * methods so they are pushed to Supabase alongside user-created data.
   */
  private async ensureDefaultsSynced() {
    const flag = await getSyncState('defaultsSynced');
    if (flag === 'true') return;

    const categories = await fetchTableRows<Record<string, unknown>>(
      'categories',
      'isCustom = 0 AND deletedAt IS NULL',
    );
    for (const cat of categories) {
      await enqueueSync('categories', String(cat.id), 'upsert', cat);
      await markRecordSyncStatus('categories', String(cat.id), 'pending');
    }

    const paymentMethods = await fetchTableRows<Record<string, unknown>>(
      'payment_methods',
      'isCustom = 0 AND deletedAt IS NULL',
    );
    for (const pm of paymentMethods) {
      await enqueueSync('payment_methods', String(pm.id), 'upsert', pm);
      await markRecordSyncStatus('payment_methods', String(pm.id), 'pending');
    }

    await setSyncState('defaultsSynced', 'true');

    // Enqueue the default Cash account on the first sync (or whenever the flag
    // is missing, e.g. on fresh installs). Uses a separate flag so existing
    // users who already ran ensureDefaultsSynced still get their Cash account pushed.
    await this.ensureCashAccountSynced();
  }

  /** Enqueue the seeded 'acc_cash' account for push to Supabase once per install. */
  private async ensureCashAccountSynced() {
    const cashFlag = await getSyncState('cashDefaultSynced');
    if (cashFlag === 'true') return;

    const cashAccount = await fetchLocalRecord('accounts', 'acc_cash');
    if (cashAccount && !cashAccount.deletedAt) {
      await enqueueSync('accounts', 'acc_cash', 'upsert', cashAccount);
      await markRecordSyncStatus('accounts' as SyncableTable, 'acc_cash', 'pending');
    }

    await setSyncState('cashDefaultSynced', 'true');
  }

  /**
   * Tables grouped by dependency tier for parallel pulling.
   * Tier 0: independent tables (no FK deps on other synced tables)
   * Tier 1: depend on tier 0 (transactions → categories/accounts)
   * Tier 2-3: depend on tier 1 (splits → transactions)
   */
  private static readonly PULL_TIERS: SyncableTable[][] = [
    [
      'user_profile',
      'accounts',
      'categories',
      'payment_methods',
      'split_friends',
      'goals',
      'assets',
      'liabilities',
      'notes',
      'recurring_templates',
    ],
    ['transactions', 'budgets', 'net_worth_history'],
    ['split_expenses'],
    ['split_members'],
  ];

  private async pullRemoteChanges() {
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user?.id;
    if (!userId) {
      return;
    }

    const lastSyncAt = await getLastSyncTimestamp();
    const allSyncable = new Set(getSyncableTables());

    for (const tier of SyncService.PULL_TIERS) {
      const tablesToPull = tier.filter((t) => allSyncable.has(t));
      if (tablesToPull.length === 0) continue;

      let tierChanged = false;
      const results = await Promise.allSettled(
        tablesToPull.map(async (table) => {
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
            return false;
          }

          const localRows = await fetchTableRows<Record<string, unknown>>(table);
          const localById = new Map(localRows.map((row) => [String(row.id), row]));
          const mergeResult = await this.mergeRemoteRecords(
            table,
            (data ?? []) as Record<string, unknown>[],
            localById,
          );
          return mergeResult.changed;
        }),
      );

      // If a schema-missing error was thrown in any table, re-throw it
      for (const result of results) {
        if (result.status === 'rejected') {
          const err = result.reason as unknown;
          if (this.isRemoteSchemaMissing(err)) {
            throw err;
          }
        } else if (result.value) {
          tierChanged = true;
        }
      }

      if (tierChanged) {
        useAppStore.getState().bumpDataRevision();
      }
    }
  }

  /** Full sync for first login — pulls ALL remote data regardless of lastSyncAt */
  async initialSync(): Promise<{
    success: boolean;
    recordsPulled: number;
    error?: string;
  }> {
    await setLastSyncTimestamp('1970-01-01T00:00:00.000Z');

    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected) {
      return { success: false, recordsPulled: 0, error: 'offline' };
    }

    if (this.syncing) {
      return {
        success: false,
        recordsPulled: 0,
        error: 'Sync already in progress',
      };
    }

    this.syncing = true;
    this.syncStartedAt = Date.now();
    useAppStore.getState().setSyncState({ syncInProgress: true, lastSyncError: null });

    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user?.id;
      if (!userId) {
        return { success: false, recordsPulled: 0, error: 'Not authenticated' };
      }

      let totalPulled = 0;
      const allSyncable = new Set(getSyncableTables());

      for (const tier of SyncService.PULL_TIERS) {
        const tablesToPull = tier.filter((t) => allSyncable.has(t));
        if (tablesToPull.length === 0) continue;

        let tierChanged = false;
        const results = await Promise.allSettled(
          tablesToPull.map(async (table) => {
            const { data, error } = await supabase
              .from(table)
              .select('*')
              .eq('user_id', userId)
              .is('deleted_at', null)
              .order('updated_at', { ascending: true });

            if (error) {
              console.warn(`Initial pull failed for ${table}:`, error.message);
              return 0;
            }

            const mergeResult = await this.mergeRemoteRecords(
              table,
              (data ?? []) as Record<string, unknown>[],
              undefined,
              false,
            );
            return mergeResult.processedCount;
          }),
        );

        for (const result of results) {
          if (result.status === 'fulfilled' && typeof result.value === 'number') {
            totalPulled += result.value;
            if (result.value > 0) {
              tierChanged = true;
            }
          }
        }

        if (tierChanged) {
          useAppStore.getState().bumpDataRevision();
        }
      }

      const completedAt = new Date().toISOString();
      await setLastSyncTimestamp(completedAt);
      useAppStore.getState().setSyncState({
        syncInProgress: false,
        lastSyncAt: completedAt,
        lastSyncError: null,
      });
      useAppStore.getState().bumpDataRevision();

      return { success: true, recordsPulled: totalPulled };
    } catch (error) {
      const msg = errorMessage(error);
      useAppStore.getState().setSyncState({ syncInProgress: false, lastSyncError: msg });
      return { success: false, recordsPulled: 0, error: msg };
    } finally {
      this.syncing = false;
    }
  }
}

export const syncService = new SyncService();

export const triggerBackgroundSync = async (reason: string) => {
  await syncService.requestSync(reason);
};
