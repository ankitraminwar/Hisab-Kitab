---
name: 'Sync Layer Instructions'
description: 'Rules for syncQueue, syncEngine, syncTransform and all sync-related files'
applyTo: 'src/services/sync*.ts,src/services/syncTransform.ts,src/services/syncService.ts'
---

# Sync Layer — Hisab Kitab

## The Prime Directive

The sync layer is a **background queue**. It never blocks the UI thread, never throws to the UI,
and is transparent to the user unless a persistent failure occurs. The app must remain 100%
functional without any network connectivity.

---

## `enqueueSync()` — exact 4-argument signature

**Import:** `import { enqueueSync } from '@/database';`

```ts
// Signature: (table, recordId, operation, payload)
// operation is ALWAYS 'upsert' or 'delete' — never INSERT/UPDATE/DELETE

// Upsert (create OR update — always use 'upsert', not 'insert' or 'update')
await enqueueSync('transactions', id, 'upsert', record as unknown as Record<string, unknown>);

// Soft delete
await enqueueSync('transactions', id, 'delete', {
  id,
  deletedAt,
  updatedAt: deletedAt,
});
```

### Boolean fields — convert to 0/1 in the payload

SQLite booleans are stored as integers. Convert before passing as the payload:

```ts
await enqueueSync('accounts', account.id, 'upsert', {
  ...account,
  isDefault: account.isDefault ? 1 : 0,
} as unknown as Record<string, unknown>);
```

### `tags` field — do NOT pre-parse

`tags` is stored as a JSON string in SQLite (`TEXT DEFAULT '[]'`) but Supabase expects `jsonb`.
The sync service automatically parses it on push. **Pass it as-is as a string in the payload.**

```ts
// CORRECT — pass the raw string
await enqueueSync('transactions', id, 'upsert', { ...record, tags: record.tags });

// WRONG — do not pre-parse
await enqueueSync('transactions', id, 'upsert', {
  ...record,
  tags: JSON.parse(record.tags), // ❌ sync service handles this
});
```

---

## `syncTransform.ts` — all column mapping lives here

File: `src/services/syncTransform.ts`

```ts
// The file defines table-specific mappings.
// Base fields (userId, syncStatus, createdAt, updatedAt, deletedAt, lastSyncedAt)
// are handled by baseLocalToRemote — do NOT repeat them in table-specific mappings.

yourTable: {
  someField: 'some_field',
  anotherField: 'another_field',
},
// The file automatically inverts this for remote→local direction.
```

**Never** inline column remapping anywhere else in the codebase.

---

## Full Write Pattern — all 4 steps required

```ts
import { getDatabase, enqueueSync } from '@/database';
import { generateId } from '@/utils/constants';
import { useAppStore } from '@/store/appStore';
import { triggerBackgroundSync } from '@/services/syncService';

export async function createItem(data: CreateItemInput): Promise<Item> {
  const db = getDatabase();   // synchronous — no await
  const id = generateId();
  const now = new Date().toISOString();

  const item: Item = {
    id,
    // ...fields
    createdAt: now,
    updatedAt: now,
    userId: null,
    syncStatus: 'pending',
    lastSyncedAt: null,
    deletedAt: null,
  };

  // Step 1: Write to SQLite
  await db.runAsync(
    `INSERT INTO your_table (id, ...) VALUES (?, ...)`,
    [item.id, ...]
  );

  // Step 2: Queue sync — (table, recordId, operation, payload)
  await enqueueSync('your_table', id, 'upsert', item as unknown as Record<string, unknown>);

  // Step 3: Bump revision → subscribed screens re-fetch
  useAppStore.getState().bumpDataRevision();

  // Step 4: Fire-and-forget background sync
  triggerBackgroundSync('your_table-created').catch(console.warn);

  return item;
}
```

## Soft Delete Pattern

```ts
async function deleteItem(id: string) {
  const db = getDatabase();
  const deletedAt = new Date().toISOString();

  // Step 1
  await db.runAsync(
    `UPDATE your_table SET deletedAt = ?, updatedAt = ?, syncStatus = 'pending' WHERE id = ?`,
    [deletedAt, deletedAt, id],
  );

  // Step 2
  await enqueueSync('your_table', id, 'delete', { id, deletedAt, updatedAt: deletedAt });

  // Step 3
  useAppStore.getState().bumpDataRevision();

  // Step 4
  triggerBackgroundSync('your_table-deleted').catch(console.warn);
}
```

---

## Column Naming

| Location | Convention | Exception                                        |
| -------- | ---------- | ------------------------------------------------ |
| SQLite   | camelCase  | `split_expenses`, `split_members` use snake_case |
| Supabase | snake_case | Always                                           |

---

## SYNCABLE_TABLES

Only tables listed in `SYNCABLE_TABLES` in `src/utils/constants.ts` participate in sync.
When adding a new syncable table, add its name to that constant AND add column mappings
in `syncTransform.ts`.

---

## Sync Internals — Do Not Break These

- **Queue compaction**: `enqueueSync()` merges multiple mutations for the same `entity+recordId`
  into one queue entry — only the latest payload is pushed.
- **Parallel pulls**: `pullRemoteChanges()` and `initialSync()` use `Promise.allSettled()` pulling
  by dependency tier. Do not add inter-table dependencies that would break this tiered approach.
  - Tier 0: `accounts`, `categories`, `payment_methods`, `goals`, `assets`, `liabilities`, `user_profile`
  - Tier 1: `transactions`, `budgets`, `net_worth_history`
  - Tier 2: `split_expenses`
  - Tier 3: `split_members`
- **Conflict resolution**: latest `updated_at` wins.
- **Default data bootstrap**: `ensureDefaultsSynced()` runs once per device on first push,
  enqueuing all default (non-custom) categories and payment methods. Do not modify this flow.
- **No inter-table FK constraints on Supabase** — only `user_id → auth.users(id)` FK is retained.
  This is intentional to allow out-of-order push without FK violations. SQLite enforces FK
  integrity locally.
