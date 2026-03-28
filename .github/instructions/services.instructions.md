---
name: 'Service Layer Instructions'
description: 'Rules for all service files in src/services/'
applyTo: 'src/services/**/*.ts'
---

# Service Layer — Hisab Kitab

## Correct Imports in Service Files

```ts
import { getDatabase, enqueueSync } from '@/database'; // getDatabase — not getDb
import { generateId } from '@/utils/constants';
import { useAppStore } from '@/store/appStore';
import { triggerBackgroundSync } from '@/services/syncService';
```

---

## Complete Service Function Pattern

```ts
export async function createItem(data: CreateItemInput): Promise<Item> {
  const db = getDatabase();   // synchronous — no await
  const id = generateId();
  const now = new Date().toISOString();

  const item: Item = {
    id,
    ...data,
    createdAt: now,
    updatedAt: now,
    userId: null,
    syncStatus: 'pending',
    lastSyncedAt: null,
    deletedAt: null,
  };

  // 1. Write to SQLite
  await db.runAsync(
    `INSERT INTO your_table (id, ...) VALUES (?, ...)`,
    [item.id, ...]
  );

  // 2. Queue sync: (table, recordId, operation, payload)
  await enqueueSync('your_table', id, 'upsert', item as unknown as Record<string, unknown>);

  // 3. Bump revision — subscribed screens re-fetch automatically
  useAppStore.getState().bumpDataRevision();

  // 4. Fire-and-forget background sync
  triggerBackgroundSync('your_table-created').catch(console.warn);

  return item;
}
```

## Update Pattern

```ts
export async function updateItem(id: string, changes: Partial<Item>): Promise<void> {
  const db = getDatabase();
  const updatedAt = new Date().toISOString();

  await db.runAsync(
    `UPDATE your_table SET field = ?, updatedAt = ?, syncStatus = 'pending' WHERE id = ?`,
    [changes.field, updatedAt, id],
  );

  await enqueueSync('your_table', id, 'upsert', {
    id,
    ...changes,
    updatedAt,
  } as unknown as Record<string, unknown>);

  useAppStore.getState().bumpDataRevision();
  triggerBackgroundSync('your_table-updated').catch(console.warn);
}
```

## Soft Delete Pattern

```ts
export async function deleteItem(id: string): Promise<void> {
  const db = getDatabase();
  const deletedAt = new Date().toISOString();

  await db.runAsync(
    `UPDATE your_table SET deletedAt = ?, updatedAt = ?, syncStatus = 'pending' WHERE id = ?`,
    [deletedAt, deletedAt, id],
  );

  await enqueueSync('your_table', id, 'delete', { id, deletedAt, updatedAt: deletedAt });

  useAppStore.getState().bumpDataRevision();
  triggerBackgroundSync('your_table-deleted').catch(console.warn);
}
```

---

## Boolean Fields in Sync Payloads

SQLite booleans are integers (0/1). Convert before sync payload:

```ts
await enqueueSync('accounts', account.id, 'upsert', {
  ...account,
  isDefault: account.isDefault ? 1 : 0,
} as unknown as Record<string, unknown>);
```

Fields affected: `isDefault`, `isRecurring`, `isCompleted`, `isCustom`,
`notificationsEnabled`, `biometricEnabled`.

---

## Widget Refresh for Transaction Mutations

`TransactionService.create/update/delete` also refreshes Android widgets.
If your new service mutates transaction-adjacent data, follow this pattern:

```ts
// Lazy import to avoid circular dependency
const refreshWidgets = async () => {
  const { refreshAllWidgets } = await import('@/widgets/refreshWidgets');
  return refreshAllWidgets();
};
// After the write:
refreshWidgets().catch(console.warn);
```

---

## Unbounded Queries — Always Use LIMIT

```ts
// CORRECT
await TransactionService.getAll({ limit: 50 }); // default
await TransactionService.getAll({ limit: 100 }); // picker lists

// WRONG — never unbounded
await db.getAllAsync('SELECT * FROM transactions', []); // ❌ no LIMIT
```

---

## Service File Reference

| Service                | File                    | Responsibility                            |
| ---------------------- | ----------------------- | ----------------------------------------- |
| `TransactionService`   | `transactionService.ts` | Transaction CRUD, filtered queries, stats |
| `AccountService`       | `dataService.ts`        | Account CRUD                              |
| `CategoryService`      | `dataService.ts`        | Category CRUD                             |
| `BudgetService`        | `dataService.ts`        | Budget CRUD + spent calculation           |
| `GoalService`          | `dataService.ts`        | Goal CRUD + fund/withdraw                 |
| `PaymentMethodService` | `dataService.ts`        | Payment method CRUD                       |
| `NetWorthService`      | `dataService.ts`        | Asset, Liability, history CRUD            |
| `UserProfileService`   | `dataService.ts`        | Profile read/upsert                       |
| `SplitService`         | `splitService.ts`       | Split expense and friend management       |
| `SyncService`          | `syncService.ts`        | Background push/pull orchestration        |
| `syncTransform`        | `syncTransform.ts`      | camelCase ↔ snake_case column mapping     |
| `authService`          | `auth.ts`               | Auth, biometric, session                  |
| `MigrationRunner`      | `MigrationRunner.ts`    | SQLite migration helper                   |

---

## Adding a New Database Table — Checklist

1. Add table definition to `src/database/index.ts` schema SQL
2. If syncable: add to `SYNCABLE_TABLES` in `src/utils/constants.ts`
3. If syncable: add column mappings to `src/services/syncTransform.ts`
4. Mirror table in `supabase/schema.sql` (snake_case, RLS, `set_updated_at` trigger, indexes)
5. Create service functions with the full 4-step write pattern
6. Add types to `src/utils/types.ts`
7. Never hard-delete rows

---

## SMS Import — Android Only

```ts
// Always guard SMS APIs
import { Platform } from 'react-native';
if (Platform.OS !== 'android') return;

// Deduplicate before creating
const alreadyImported = await TransactionService.hasImportedSms(messageId);
if (alreadyImported) return;

// Tags for SMS-imported transactions
tags: ['sms-import', `sms:${messageId}`];

// SMS-imported transactions are editable — preserve the sms: origin tag
// Check isSmsImported flag: tags.some(tag => tag.startsWith('sms:'))
```
