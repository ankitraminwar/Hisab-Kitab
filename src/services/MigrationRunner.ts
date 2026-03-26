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
  {
    version: 4,
    name: 'normalize_split_column_casing',
    run: async (db) => {
      // 1. Rebuild split_expenses
      await db.execAsync('ALTER TABLE split_expenses RENAME TO split_expenses_old;');
      await db.execAsync(`
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
          syncStatus TEXT NOT NULL DEFAULT 'pending' CHECK(syncStatus IN ('synced', 'pending', 'failed')),
          lastSyncedAt TEXT,
          deletedAt TEXT,
          FOREIGN KEY (transactionId) REFERENCES transactions(id) ON DELETE CASCADE
        );
      `);
      await db.execAsync(`
        INSERT INTO split_expenses (
          id, transactionId, paidByUserId, totalAmount, splitMethod, notes, 
          createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt
        )
        SELECT 
          id, transaction_id, paid_by_user_id, total_amount, split_method, notes,
          createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt
        FROM split_expenses_old;
      `);
      await db.execAsync('DROP TABLE split_expenses_old;');

      // 2. Rebuild split_members
      await db.execAsync('ALTER TABLE split_members RENAME TO split_members_old;');
      await db.execAsync(`
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
          syncStatus TEXT NOT NULL DEFAULT 'pending' CHECK(syncStatus IN ('synced', 'pending', 'failed')),
          lastSyncedAt TEXT,
          deletedAt TEXT,
          FOREIGN KEY (splitExpenseId) REFERENCES split_expenses(id) ON DELETE CASCADE
        );
      `);
      await db.execAsync(`
        INSERT INTO split_members (
          id, splitExpenseId, friendId, name, shareAmount, sharePercent, status,
          createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt
        )
        SELECT 
          id, split_expense_id, friendId, name, share_amount, share_percent, status,
          createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt
        FROM split_members_old;
      `);
      await db.execAsync('DROP TABLE split_members_old;');

      // 3. Recreate indexes
      await db.execAsync(
        'CREATE INDEX IF NOT EXISTS idx_split_expenses_transaction ON split_expenses(transactionId);',
      );
      await db.execAsync(
        'CREATE INDEX IF NOT EXISTS idx_split_members_split_id ON split_members(splitExpenseId);',
      );
      await db.execAsync(
        'CREATE INDEX IF NOT EXISTS idx_split_members_friend_id ON split_members(friendId);',
      );
    },
  },
  {
    version: 5,
    name: 'normalize_budget_column_casing',
    run: async (db) => {
      await db.execAsync('ALTER TABLE budgets RENAME TO budgets_old;');
      await db.execAsync(`
        CREATE TABLE budgets (
          id TEXT PRIMARY KEY,
          categoryId TEXT NOT NULL,
          limitAmount REAL NOT NULL,
          spent REAL NOT NULL DEFAULT 0,
          month TEXT NOT NULL,
          year INTEGER NOT NULL,
          alertAt INTEGER DEFAULT 80,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          userId TEXT,
          syncStatus TEXT NOT NULL DEFAULT 'pending' CHECK(syncStatus IN ('synced', 'pending', 'failed')),
          lastSyncedAt TEXT,
          deletedAt TEXT,
          FOREIGN KEY (categoryId) REFERENCES categories(id)
        );
      `);
      await db.execAsync(`
        INSERT INTO budgets (
          id, categoryId, limitAmount, spent, month, year, alertAt, 
          createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt
        )
        SELECT 
          id, categoryId, limit_amount, spent, month, year, alertAt,
          createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt
        FROM budgets_old;
      `);
      await db.execAsync('DROP TABLE budgets_old;');
      await db.execAsync(
        'CREATE INDEX IF NOT EXISTS idx_budgets_month_year ON budgets(month, year);',
      );
      await db.execAsync(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_unique_cat_month ON budgets(categoryId, month, year) WHERE deletedAt IS NULL;',
      );
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
