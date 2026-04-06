import type * as SQLite from 'expo-sqlite';

type Migration = {
  version: number;
  name: string;
  run: (db: SQLite.SQLiteDatabase) => Promise<void>;
};

const ensureMigrationsTable = async (db: SQLite.SQLiteDatabase) => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
};

const getAppliedVersions = async (db: SQLite.SQLiteDatabase) => {
  const rows = await db.getAllAsync<{ version: number }>('SELECT version FROM _migrations');
  return new Set(rows.map((row) => row.version));
};

/**
 * All historical migrations (v1-v9) have been consolidated into the base schema
 * in database/index.ts. This runner now only exists for future migrations that
 * may be added post-launch. Fresh installs get the complete schema directly;
 * existing installs already ran v1-v9 via the old MigrationRunner.
 */
const migrations: Migration[] = [
  {
    version: 10,
    name: 'ensure_split_expenses_camel_case_columns',
    run: async (db) => {
      // Detect whether split_expenses was created with the old snake_case schema
      // (pre-v10). If transactionId column is missing, the table has old columns
      // and must be rebuilt with the current camelCase schema.
      const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(split_expenses)`);
      const hasNewColumn = cols.some((c) => c.name === 'transactionId');
      if (hasNewColumn) return; // already on new schema

      // Wrap in an explicit transaction so a mid-migration failure rolls back
      // automatically, preventing a partially-migrated state.
      await db.withTransactionAsync(async () => {
        // Rebuild split_members first (FK dependency), then split_expenses.
        await db.execAsync(`
          ALTER TABLE split_members RENAME TO split_members_old;

          CREATE TABLE split_members (
          id TEXT PRIMARY KEY,
          splitExpenseId TEXT NOT NULL,
          friendId TEXT,
          name TEXT NOT NULL,
          shareAmount REAL NOT NULL,
          sharePercent REAL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'dismissed')),
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          userId TEXT,
          syncStatus TEXT NOT NULL DEFAULT 'pending' CHECK(syncStatus IN ('pending', 'synced', 'failed')),
          lastSyncedAt TEXT,
          deletedAt TEXT,
          deviceId TEXT,
          FOREIGN KEY (splitExpenseId) REFERENCES split_expenses(id) ON DELETE CASCADE
        );

        INSERT INTO split_members
          (id, splitExpenseId, friendId, name, shareAmount, sharePercent, status,
           createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
        SELECT
          id,
          COALESCE(splitExpenseId, split_expense_id),
          COALESCE(friendId, friend_id),
          name,
          COALESCE(shareAmount, share_amount),
          COALESCE(sharePercent, share_percent),
          status,
          COALESCE(createdAt, created_at),
          COALESCE(updatedAt, updated_at),
          COALESCE(userId, user_id),
          COALESCE(syncStatus, sync_status, 'pending'),
          COALESCE(lastSyncedAt, last_synced_at),
          COALESCE(deletedAt, deleted_at)
        FROM split_members_old;

        DROP TABLE split_members_old;

        ALTER TABLE split_expenses RENAME TO split_expenses_old;

        CREATE TABLE split_expenses (
          id TEXT PRIMARY KEY,
          transactionId TEXT NOT NULL,
          paidByUserId TEXT NOT NULL,
          totalAmount REAL NOT NULL,
          splitMethod TEXT NOT NULL CHECK(splitMethod IN ('equal', 'exact', 'percent')),
          notes TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          userId TEXT,
          syncStatus TEXT NOT NULL DEFAULT 'pending' CHECK(syncStatus IN ('pending', 'synced', 'failed')),
          lastSyncedAt TEXT,
          deletedAt TEXT,
          deviceId TEXT,
          FOREIGN KEY (transactionId) REFERENCES transactions(id) ON DELETE CASCADE
        );

        INSERT INTO split_expenses
          (id, transactionId, paidByUserId, totalAmount, splitMethod, notes,
           createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
        SELECT
          id,
          COALESCE(transactionId, transaction_id),
          COALESCE(paidByUserId, paid_by_user_id),
          COALESCE(totalAmount, total_amount),
          COALESCE(splitMethod, split_method),
          notes,
          COALESCE(createdAt, created_at),
          COALESCE(updatedAt, updated_at),
          COALESCE(userId, user_id),
          COALESCE(syncStatus, sync_status, 'pending'),
          COALESCE(lastSyncedAt, last_synced_at),
          COALESCE(deletedAt, deleted_at)
        FROM split_expenses_old;

        DROP TABLE split_expenses_old;
        `);
      });
    },
  },
  {
    version: 11,
    name: 'add_device_id_column',
    run: async (db) => {
      // Add deviceId TEXT to every syncable table for existing installs.
      // New installs already have it via baseSyncColumns in database/index.ts.
      // ALTER TABLE ... ADD COLUMN is a no-op if the column already exists in SQLite,
      // but we guard with PRAGMA table_info to be safe.
      const tables = [
        'accounts',
        'categories',
        'transactions',
        'budgets',
        'goals',
        'assets',
        'liabilities',
        'net_worth_history',
        'user_profile',
        'recurring_templates',
        'split_expenses',
        'split_members',
        'split_friends',
        'payment_methods',
        'notes',
      ];

      for (const table of tables) {
        const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
        const hasDeviceId = cols.some((c) => c.name === 'deviceId');
        if (!hasDeviceId) {
          await db.execAsync(`ALTER TABLE ${table} ADD COLUMN deviceId TEXT`);
        }
      }
    },
  },
];

/** Clean up any orphaned _old tables left by previous migration renames. */
const cleanupOrphanedTables = async (db: SQLite.SQLiteDatabase) => {
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_old'`,
  );
  for (const { name } of rows) {
    await db.execAsync(`DROP TABLE IF EXISTS "${name}"`);
  }
};

export const runMigrations = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  await ensureMigrationsTable(db);
  await cleanupOrphanedTables(db);

  if (migrations.length === 0) return;

  const applied = await getAppliedVersions(db);
  const pending = migrations.filter((m) => !applied.has(m.version));

  for (const migration of pending) {
    await migration.run(db);
    await db.runAsync('INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)', [
      migration.version,
      migration.name,
      new Date().toISOString(),
    ]);
  }
};
