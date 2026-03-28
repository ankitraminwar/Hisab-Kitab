---
name: 'Database Layer Instructions'
description: 'Rules for SQLite database access across all service and screen files'
applyTo: 'src/database/**/*.ts,src/services/**Service.ts,src/services/dataService.ts'
---

# Database Layer — Hisab Kitab

## `getDatabase()` — synchronous, no await

```ts
import { getDatabase } from '@/database';

// CORRECT — synchronous call, returns SQLiteDatabase immediately
const db = getDatabase();
await db.runAsync('INSERT INTO transactions ...', [...]);
const row = await db.getFirstAsync<Transaction>('SELECT * FROM transactions WHERE id = ?', [id]);

// WRONG — getDatabase() is NOT async
const db = await getDatabase();  // ❌ synchronous function, no await
const db = await getDb();        // ❌ wrong function name entirely
```

---

## Async API — always use these methods

```ts
const db = getDatabase();

// Single row
const row = await db.getFirstAsync<Transaction>(
  'SELECT * FROM transactions WHERE id = ?',
  [id]
);

// Multiple rows
const rows = await db.getAllAsync<Transaction>(
  `SELECT * FROM transactions WHERE deletedAt IS NULL ORDER BY date DESC`,
  []
);

// Write (INSERT / UPDATE)
await db.runAsync(
  `INSERT INTO transactions (id, amount, categoryId, date, createdAt, updatedAt, syncStatus)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [id, amount, categoryId, date, now, now, 'pending']
);

// Multi-step writes — always use a transaction
await db.withTransactionAsync(async () => {
  await db.runAsync('INSERT INTO transactions ...', [...]);
  await db.runAsync('UPDATE accounts SET balance = ? WHERE id = ?', [...]);
});
```

---

## Parameterize Every Query — No String Interpolation

```ts
// CORRECT — parameterized
await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
await db.getAllAsync('SELECT * FROM transactions WHERE month = ?', [month]);

// WRONG — SQL injection risk, ESLint error
await db.runAsync(`DELETE FROM transactions WHERE id = '${id}'`); // ❌
await db.getAllAsync(`SELECT * FROM transactions WHERE month = '${month}'`); // ❌
```

---

## IDs — always `generateId()`

```ts
import { generateId } from '@/utils/constants';
const id = generateId(); // UUID string — source of truth for all entity IDs

// WRONG
const id = crypto.randomUUID(); // ❌
const id = Math.random().toString(36).slice(2); // ❌
```

---

## Soft Delete — Never Hard Delete

```ts
// CORRECT — soft delete
const deletedAt = new Date().toISOString();
await db.runAsync(
  `UPDATE transactions SET deletedAt = ?, updatedAt = ?, syncStatus = 'pending' WHERE id = ?`,
  [deletedAt, deletedAt, id],
);

// WRONG — hard delete loses sync history
await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]); // ❌
```

Always filter out soft-deleted rows in queries:

```ts
// CORRECT
`SELECT * FROM transactions WHERE deletedAt IS NULL`
// WRONG — returns deleted rows
`SELECT * FROM transactions`; // ❌ unless intentionally querying all
```

---

## Every Syncable Table Must Have These Columns

```sql
syncStatus    TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'synced' | 'failed'
deletedAt     TEXT,                              -- NULL = not deleted; ISO string = soft-deleted
createdAt     TEXT NOT NULL DEFAULT (datetime('now')),
updatedAt     TEXT NOT NULL DEFAULT (datetime('now')),
userId        TEXT,
lastSyncedAt  TEXT
```

---

## Column Naming

- **All SQLite columns**: camelCase (`categoryId`, `createdAt`, `syncStatus`)
- **Exception**: `split_expenses` and `split_members` already use snake_case column names
  (`transaction_id`, `paid_by_user_id`, etc.). If adding a new split-related table, follow that pattern.
- **Supabase**: snake_case always
- **Mapping**: `src/services/syncTransform.ts` — never inline it elsewhere

---

## SQLite Migrations — `MigrationRunner.ts`

When adding columns to existing tables, use the migration runner to avoid destroying user data:

```ts
// src/services/MigrationRunner.ts
const migrations: Migration[] = [
  {
    version: 2, // always increment from highest existing version
    name: 'add_new_column',
    run: async (db) => {
      await db.execAsync(`ALTER TABLE your_table ADD COLUMN newColumn TEXT;`);
    },
  },
];
```

Migrations run on every app start, are tracked in `_migrations` table, and are skipped if
already applied. **Never modify an existing migration** — add a new one instead.

---

## Query Best Practices

- Always include `LIMIT` when calling `TransactionService.getAll()` — default 50, picker lists 100
- For budget spending, use a single `LEFT JOIN` — avoid correlated subqueries
- Dashboard donut chart uses `getCategoryBreakdownByDateRange()` — do not limit to recent items
- CSV export uses 1000-row streaming chunks — do not load entire dataset into memory
