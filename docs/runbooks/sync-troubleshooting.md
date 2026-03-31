# Sync Troubleshooting Runbook

## Symptoms & Resolutions

---

> This doc for reference only

### 1. Transactions not appearing on another device

**Symptom**: Data saved on Device A doesn't appear on Device B.

**Diagnosis Steps**:

1. Confirm both devices are logged into the same account
2. Check network connectivity on Device A
3. Check if the sync queue has pending items:
   - In SQLite: `SELECT * FROM sync_queue WHERE status = 'pending'`
4. Check Supabase dashboard → Table Editor → `transactions` for the missing row

**Resolution**:

- If pending in sync queue: connectivity issue. Wait or trigger manual sync from Settings.
- If in Supabase but not on Device B: Device B hasn't pulled yet. Force a pull sync.
- If not in Supabase: Check `sync_queue` for `status = 'failed'` entries. Review error message.

---

### 2. Duplicate entries after sync

**Symptom**: Same transaction appears twice.

**Diagnosis**:

- Check if both entries have the same `id` (UUID) — if different IDs, it's two separate inserts
- Check `createdAt` timestamps — if identical, likely a double-tap issue
- Check if sync ran twice due to app restart during sync

**Resolution**:

- Soft-delete the duplicate: `UPDATE transactions SET deletedAt = datetime('now') WHERE id = ?`
- Never hard delete — the sync engine needs the `deletedAt` marker to propagate the delete

---

### 3. Schema mismatch errors during sync

**Symptom**: Sync fails with column-not-found or type mismatch errors.

**Diagnosis**:

1. Compare `src/database/index.ts` column names (camelCase) with `supabase/schema.sql` (snake_case)
2. Check `src/services/syncTransform.ts` for missing column mappings
3. Check if a migration was missed in `src/services/MigrationRunner.ts`

**Resolution**:

- Add missing column mapping in `syncTransform.ts`
- If the SQLite schema is behind, add a migration in `MigrationRunner.ts`
- If the Supabase schema is behind, create a migration in `supabase/migrations/`
- Run `yarn typecheck` to verify type alignment

---

### 4. Sync stuck in "syncing" state

**Symptom**: Sync indicator never completes.

**Diagnosis**:

- Check if there's an unhandled promise rejection in the sync engine
- Check network connectivity
- Check Supabase service status

**Resolution**:

- Close and reopen the app (clears in-memory sync lock)
- If persistent, check `sync_queue` for rows with `status = 'in_progress'` that are stale (>5 min old)
- Reset stale rows: `UPDATE sync_queue SET status = 'pending' WHERE status = 'in_progress' AND updatedAt < datetime('now', '-5 minutes')`

---

### 5. RLS policy blocking sync

**Symptom**: Sync returns 403 or "new row violates row-level security policy" error.

**Diagnosis**:

1. Check that the `userId` in the synced row matches `auth.uid()`
2. Check Supabase RLS policies for the affected table
3. Check if the user's JWT has expired

**Resolution**:

- Ensure every row includes the current user's `userId` before sync
- Refresh the auth session: the app should auto-refresh tokens
- If policies are wrong, fix in `supabase/schema.sql` and create a migration
