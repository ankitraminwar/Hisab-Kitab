import type * as SQLite from 'expo-sqlite';

type Migration = {
  version: number;
  name: string;
  run: (db: SQLite.SQLiteDatabase) => Promise<void>;
};

const DOMAIN_TABLES = [
  'accounts',
  'categories',
  'transactions',
  'budgets',
  'goals',
  'assets',
  'liabilities',
  'user_profile',
  'recurring_templates',
  'net_worth_history',
  'split_expenses',
  'split_members',
  'split_friends',
  'payment_methods',
] as const;

const REQUIRED_SYNC_COLUMNS: { name: string; sqlType: string }[] = [
  { name: 'sync_status', sqlType: "TEXT NOT NULL DEFAULT 'PENDING'" },
  { name: 'last_modified', sqlType: 'INTEGER NOT NULL DEFAULT 0' },
  { name: 'server_id', sqlType: 'TEXT' },
  { name: 'version_hash', sqlType: 'TEXT' },
];

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

const getTableColumns = async (db: SQLite.SQLiteDatabase, tableName: string) => {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`);
  return new Set(columns.map((column) => column.name));
};

const addMissingSyncColumns = async (db: SQLite.SQLiteDatabase, tableName: string) => {
  const existingColumns = await getTableColumns(db, tableName);

  for (const column of REQUIRED_SYNC_COLUMNS) {
    if (existingColumns.has(column.name)) {
      continue;
    }

    await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${column.sqlType};`);
  }
};

const migrations: Migration[] = [
  {
    version: 1,
    name: 'add_required_sync_metadata_columns',
    run: async (db) => {
      for (const tableName of DOMAIN_TABLES) {
        await addMissingSyncColumns(db, tableName);
      }
    },
  },
  {
    version: 2,
    name: 'add_avatar_column_to_user_profile',
    run: async (db) => {
      const columns = await getTableColumns(db, 'user_profile');
      if (!columns.has('avatar')) {
        await db.execAsync(`ALTER TABLE user_profile ADD COLUMN avatar TEXT;`);
      }
    },
  },
  {
    version: 3,
    name: 'add_split_friends_and_split_member_friend_id',
    run: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS split_friends (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          userId TEXT,
          syncStatus TEXT NOT NULL DEFAULT 'pending',
          lastSyncedAt TEXT,
          deletedAt TEXT
        );
      `);

      const splitMemberColumns = await getTableColumns(db, 'split_members');
      if (!splitMemberColumns.has('friendId')) {
        await db.execAsync(`ALTER TABLE split_members ADD COLUMN friendId TEXT;`);
      }
    },
  },
];

export const runMigrations = async (db: SQLite.SQLiteDatabase) => {
  await ensureMigrationsTable(db);
  const applied = await getAppliedVersions(db);

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }

    await db.execAsync('BEGIN IMMEDIATE TRANSACTION;');
    try {
      await migration.run(db);
      await db.runAsync(`INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?);`, [
        migration.version,
        migration.name,
        new Date().toISOString(),
      ]);
      await db.execAsync('COMMIT;');
    } catch (error) {
      await db.execAsync('ROLLBACK;');
      throw error;
    }
  }
};
