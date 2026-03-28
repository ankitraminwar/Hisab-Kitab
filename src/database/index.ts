import * as SQLite from 'expo-sqlite';
import { runMigrations } from '../services/MigrationRunner';
import { generateId, SYNCABLE_TABLES, type SyncableTable } from '../utils/constants';
import type { SyncQueueItem, SyncStatus } from '../utils/types';

let db: SQLite.SQLiteDatabase | null = null;
let initialized = false;
let initializingPromise: Promise<void> | null = null;

const normalizeBindValue = (value: unknown): SQLite.SQLiteBindValue => {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Uint8Array
  ) {
    return (value ?? null) as SQLite.SQLiteBindValue;
  }

  return JSON.stringify(value);
};

const baseSyncColumns = `
  userId TEXT,
  syncStatus TEXT NOT NULL DEFAULT 'pending' CHECK(syncStatus IN ('synced', 'pending', 'failed')),
  lastSyncedAt TEXT,
  deletedAt TEXT,
  last_modified INTEGER NOT NULL DEFAULT 0,
  server_id TEXT,
  version_hash TEXT
`;

const transactionalTables = [
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('cash','bank','upi','credit_card','wallet','investment')),
    balance REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    color TEXT DEFAULT '#7C3AED',
    icon TEXT DEFAULT 'wallet',
    isDefault INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    ${baseSyncColumns}
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('expense','income','both')),
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    isCustom INTEGER DEFAULT 0,
    parentId TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    ${baseSyncColumns}
  )`,
  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('expense','income','transfer')),
    categoryId TEXT NOT NULL,
    accountId TEXT NOT NULL,
    toAccountId TEXT,
    merchant TEXT,
    notes TEXT,
    tags TEXT DEFAULT '[]',
    date TEXT NOT NULL,
    paymentMethod TEXT NOT NULL DEFAULT 'other',
    isRecurring INTEGER DEFAULT 0,
    recurringId TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    ${baseSyncColumns},
    FOREIGN KEY (categoryId) REFERENCES categories(id),
    FOREIGN KEY (accountId) REFERENCES accounts(id)
  )`,
  `CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    categoryId TEXT NOT NULL,
    limitAmount REAL NOT NULL,
    spent REAL NOT NULL DEFAULT 0,
    month TEXT NOT NULL,
    year INTEGER NOT NULL,
    alertAt INTEGER DEFAULT 80,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    ${baseSyncColumns},
    FOREIGN KEY (categoryId) REFERENCES categories(id)
  )`,
  `CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    targetAmount REAL NOT NULL,
    currentAmount REAL NOT NULL DEFAULT 0,
    deadline TEXT,
    icon TEXT DEFAULT 'flag',
    color TEXT DEFAULT '#7C3AED',
    accountId TEXT,
    isCompleted INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    ${baseSyncColumns}
  )`,
  `CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('bank','cash','stocks','mutual_funds','crypto','gold','real_estate','other')),
    value REAL NOT NULL,
    notes TEXT,
    lastUpdated TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    ${baseSyncColumns}
  )`,
  `CREATE TABLE IF NOT EXISTS liabilities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('credit_card','loan','mortgage','other')),
    amount REAL NOT NULL,
    interestRate REAL DEFAULT 0,
    dueDate TEXT,
    notes TEXT,
    lastUpdated TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    ${baseSyncColumns}
  )`,
  `CREATE TABLE IF NOT EXISTS user_profile (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'Hisab Kitab User',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT,
    currency TEXT NOT NULL DEFAULT 'INR',
    monthlyBudget REAL NOT NULL DEFAULT 0,
    themePreference TEXT NOT NULL DEFAULT 'system' CHECK(themePreference IN ('dark','light','system')),
    notificationsEnabled INTEGER NOT NULL DEFAULT 0,
    biometricEnabled INTEGER NOT NULL DEFAULT 0,
    avatar TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    ${baseSyncColumns}
  )`,
  `CREATE TABLE IF NOT EXISTS recurring_templates (
    id TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    type TEXT NOT NULL,
    categoryId TEXT NOT NULL,
    accountId TEXT NOT NULL,
    merchant TEXT,
    notes TEXT,
    tags TEXT DEFAULT '[]',
    frequency TEXT NOT NULL CHECK(frequency IN ('daily','weekly','monthly','yearly')),
    startDate TEXT NOT NULL,
    nextDue TEXT NOT NULL,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    ${baseSyncColumns}
  )`,
  `CREATE TABLE IF NOT EXISTS net_worth_history (
    id TEXT PRIMARY KEY,
    totalAssets REAL NOT NULL,
    totalLiabilities REAL NOT NULL,
    netWorth REAL NOT NULL,
    date TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    ${baseSyncColumns}
  )`,
  `CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY,
    entity TEXT NOT NULL,
    recordId TEXT NOT NULL,
    operation TEXT NOT NULL CHECK(operation IN ('upsert', 'delete')),
    payload TEXT NOT NULL,
    retryCount INTEGER NOT NULL DEFAULT 0,
    lastError TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS split_expenses (
    id TEXT PRIMARY KEY,
    transactionId TEXT NOT NULL,
    paidByUserId TEXT NOT NULL,
    totalAmount REAL NOT NULL,
    splitMethod TEXT NOT NULL CHECK(splitMethod IN ('equal', 'exact', 'percent')),
    notes TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    ${baseSyncColumns},
    FOREIGN KEY (transactionId) REFERENCES transactions(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS split_members (
    id TEXT PRIMARY KEY,
    splitExpenseId TEXT NOT NULL,
    friendId TEXT,
    name TEXT NOT NULL,
    shareAmount REAL NOT NULL,
    sharePercent REAL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'dismissed')),
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    ${baseSyncColumns},
    FOREIGN KEY (splitExpenseId) REFERENCES split_expenses(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS split_friends (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    ${baseSyncColumns}
  )`,
  `CREATE TABLE IF NOT EXISTS payment_methods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'card',
    color TEXT NOT NULL DEFAULT '#8B5CF6',
    isCustom INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    ${baseSyncColumns}
  )`,
  `CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    color TEXT DEFAULT '#7C3AED',
    isPinned INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    ${baseSyncColumns}
  )`,
];

const indexes = [
  `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC, createdAt DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_transaction_date ON transactions(date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_category_account ON transactions(categoryId, accountId)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(categoryId)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(accountId)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_updatedAt ON transactions(updatedAt DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_deletedAt ON transactions(deletedAt)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_search ON transactions(merchant, notes, date)`,
  `CREATE INDEX IF NOT EXISTS idx_budgets_month_year ON budgets(month, year)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_unique_cat_month ON budgets(categoryId, month, year) WHERE deletedAt IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_entity_record ON sync_queue(entity, recordId)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_retryCount ON sync_queue(retryCount, updatedAt)`,
  `CREATE INDEX IF NOT EXISTS idx_split_expenses_transaction ON split_expenses(transactionId)`,
  `CREATE INDEX IF NOT EXISTS idx_split_members_split_id ON split_members(splitExpenseId)`,
  `CREATE INDEX IF NOT EXISTS idx_split_members_friend_id ON split_members(friendId)`,
  `CREATE INDEX IF NOT EXISTS idx_split_friends_name ON split_friends(name)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_type_date_category ON transactions(type, date DESC, categoryId)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_tags ON transactions(tags)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_dashboard ON transactions(date DESC, type)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_filter ON transactions(type, categoryId, accountId)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_cat_type_deleted ON transactions(categoryId, type, deletedAt DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(merchant)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_notes ON transactions(notes)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_amount ON transactions(amount)`,
];

const defaultCategories = [
  // Expense categories
  {
    id: 'cat_food',
    name: 'Food & Dining',
    type: 'expense',
    icon: 'restaurant',
    color: '#F97316',
  },
  {
    id: 'cat_groceries',
    name: 'Groceries',
    type: 'expense',
    icon: 'cart',
    color: '#22C55E',
  },
  {
    id: 'cat_transport',
    name: 'Transport',
    type: 'expense',
    icon: 'car',
    color: '#3B82F6',
  },
  {
    id: 'cat_shopping',
    name: 'Shopping',
    type: 'expense',
    icon: 'bag',
    color: '#EC4899',
  },
  {
    id: 'cat_rent',
    name: 'Rent',
    type: 'expense',
    icon: 'home',
    color: '#8B5CF6',
  },
  {
    id: 'cat_utilities',
    name: 'Utilities',
    type: 'expense',
    icon: 'flash',
    color: '#EAB308',
  },
  {
    id: 'cat_entertainment',
    name: 'Entertainment',
    type: 'expense',
    icon: 'film',
    color: '#E879F9',
  },
  {
    id: 'cat_health',
    name: 'Health',
    type: 'expense',
    icon: 'medkit',
    color: '#EF4444',
  },
  {
    id: 'cat_education',
    name: 'Education',
    type: 'expense',
    icon: 'school',
    color: '#06B6D4',
  },
  {
    id: 'cat_personal',
    name: 'Personal Care',
    type: 'expense',
    icon: 'heart',
    color: '#F472B6',
  },
  {
    id: 'cat_insurance',
    name: 'Insurance',
    type: 'expense',
    icon: 'shield-checkmark',
    color: '#14B8A6',
  },
  {
    id: 'cat_subscriptions',
    name: 'Subscriptions',
    type: 'expense',
    icon: 'repeat',
    color: '#A855F7',
  },
  {
    id: 'cat_travel',
    name: 'Travel',
    type: 'expense',
    icon: 'airplane',
    color: '#0EA5E9',
  },
  {
    id: 'cat_gifts',
    name: 'Gifts & Donations',
    type: 'expense',
    icon: 'gift',
    color: '#F43F5E',
  },
  {
    id: 'cat_emi',
    name: 'EMI & Loans',
    type: 'expense',
    icon: 'card',
    color: '#DC2626',
  },
  // Income categories
  {
    id: 'cat_salary',
    name: 'Salary',
    type: 'income',
    icon: 'briefcase',
    color: '#22C55E',
  },
  {
    id: 'cat_freelance',
    name: 'Freelance',
    type: 'income',
    icon: 'laptop',
    color: '#3B82F6',
  },
  {
    id: 'cat_business',
    name: 'Business',
    type: 'income',
    icon: 'business',
    color: '#F97316',
  },
  {
    id: 'cat_investments',
    name: 'Investments',
    type: 'income',
    icon: 'trending-up',
    color: '#10B981',
  },
  {
    id: 'cat_rental_income',
    name: 'Rental Income',
    type: 'income',
    icon: 'home',
    color: '#8B5CF6',
  },
  {
    id: 'cat_refunds',
    name: 'Refunds',
    type: 'income',
    icon: 'refresh',
    color: '#06B6D4',
  },
  // Both
  {
    id: 'cat_transfer',
    name: 'Transfer',
    type: 'both',
    icon: 'swap-horizontal',
    color: '#3B82F6',
  },
  {
    id: 'cat_other',
    name: 'Other',
    type: 'both',
    icon: 'ellipsis-horizontal',
    color: '#6B7280',
  },
];

const localTablesToClear = [
  'transactions',
  'budgets',
  'goals',
  'assets',
  'liabilities',
  'net_worth_history',
  'accounts',
  'categories',
  'user_profile',
  'recurring_templates',
  'split_expenses',
  'split_members',
  'split_friends',
  'payment_methods',
  'sync_queue',
  'sync_state',
  'notes',
] as const;

export const getDatabase = (): SQLite.SQLiteDatabase => {
  if (!db) {
    db = SQLite.openDatabaseSync('hisabkitab.db');
  }
  return db;
};

export const initializeDatabase = async (): Promise<void> => {
  if (initialized) {
    return;
  }

  // If initialization is already in progress, wait for it
  if (initializingPromise) {
    await initializingPromise;
    return;
  }

  // Start initialization and store the promise
  initializingPromise = (async () => {
    const database = getDatabase();
    await database.execAsync('PRAGMA journal_mode = WAL;');
    await database.execAsync('PRAGMA foreign_keys = ON;');
    await database.execAsync('PRAGMA synchronous = NORMAL;');

    for (const statement of transactionalTables) {
      await database.execAsync(statement);
    }

    for (const statement of indexes) {
      await database.execAsync(statement);
    }

    await runMigrations(database);
    await ensureSyncStateSchema(database);

    await seedDefaultData(database);
    initialized = true;
  })();

  try {
    await initializingPromise;
  } finally {
    // Clear the promise so future calls can reinitialize if needed (e.g., after reset)
    initializingPromise = null;
  }
};

const ensureSyncStateSchema = async (database: SQLite.SQLiteDatabase) => {
  const columns = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(sync_state)`);

  if (columns.some((column) => column.name === 'key')) {
    return;
  }

  // Backfill existing installs where sync_state was created without a key column.
  await database.execAsync(
    `CREATE TABLE IF NOT EXISTS sync_state_next (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );`,
  );

  await database.execAsync(
    `INSERT OR REPLACE INTO sync_state_next (key, value, updatedAt)
     SELECT 'lastSuccessfulSyncAt', value, updatedAt FROM sync_state
     WHERE value IS NOT NULL;`,
  );

  await database.execAsync('DROP TABLE sync_state;');
  await database.execAsync('ALTER TABLE sync_state_next RENAME TO sync_state;');
};

export const seedDefaultData = async (database: SQLite.SQLiteDatabase) => {
  const now = new Date().toISOString();

  // Seed default categories
  for (const category of defaultCategories) {
    try {
      // First, ensure any existing default category is not soft‑deleted
      await database.runAsync(
        `UPDATE categories SET deletedAt = NULL, isCustom = 0 WHERE id = ? AND deletedAt IS NOT NULL`,
        [category.id],
      );
      // Insert or ignore (will ignore if already present with same PK)
      await database.runAsync(
        `INSERT OR IGNORE INTO categories
          (id, name, type, icon, color, isCustom, parentId, createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
         VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?, NULL, 'synced', ?, NULL)`,
        [category.id, category.name, category.type, category.icon, category.color, now, now, now],
      );
    } catch {
      // Seed failure for a single category is non-fatal
    }
  }

  // Seed default payment methods
  const pmDefaults = [
    { id: 'pm_cash', name: 'Cash', icon: 'cash', color: '#10B981' },
    { id: 'pm_upi', name: 'UPI', icon: 'qr-code', color: '#8B5CF6' },
    { id: 'pm_credit', name: 'Credit Card', icon: 'card', color: '#3B82F6' },
    { id: 'pm_debit', name: 'Debit Card', icon: 'card-outline', color: '#F59E0B' },
    { id: 'pm_bank', name: 'Bank Transfer', icon: 'business', color: '#6366F1' },
  ];

  for (const pm of pmDefaults) {
    try {
      await database.runAsync(
        `INSERT OR IGNORE INTO payment_methods
          (id, name, icon, color, isCustom, createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
         VALUES (?, ?, ?, ?, 0, ?, ?, NULL, 'synced', ?, NULL)`,
        [pm.id, pm.name, pm.icon, pm.color, now, now, now],
      );
    } catch {
      // Seed failure for a single payment method is non-fatal
    }
  }

  // Seed default Cash account — always ensure at least one account exists.
  // Uses a stable id ('acc_cash') so it is never duplicated on repeated seeds.
  try {
    // If it was previously soft-deleted, restore it.
    await database.runAsync(
      `UPDATE accounts SET deletedAt = NULL, isDefault = 1 WHERE id = 'acc_cash' AND deletedAt IS NOT NULL`,
    );
    await database.runAsync(
      `INSERT OR IGNORE INTO accounts
        (id, name, type, balance, currency, color, icon, isDefault, createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
       VALUES ('acc_cash', 'Cash', 'cash', 0, 'INR', '#22C55E', 'cash', 1, ?, ?, NULL, 'pending', NULL, NULL)`,
      [now, now],
    );
  } catch {
    // Seed failure for the default Cash account is non-fatal
  }
};

export const enqueueSync = async (
  entity: SyncableTable | string,
  recordId: string,
  operation: 'upsert' | 'delete',
  payload: Record<string, unknown>,
) => {
  const database = getDatabase();
  const now = new Date().toISOString();
  const existing = await database.getFirstAsync<{ id: string }>(
    'SELECT id FROM sync_queue WHERE entity = ? AND recordId = ?',
    [entity, recordId],
  );

  if (existing?.id) {
    await database.runAsync(
      `UPDATE sync_queue
       SET operation = ?, payload = ?, retryCount = 0, lastError = NULL, updatedAt = ?
       WHERE id = ?`,
      [operation, JSON.stringify(payload), now, existing.id],
    );
    return existing.id;
  }

  const id = generateId();
  await database.runAsync(
    `INSERT INTO sync_queue (id, entity, recordId, operation, payload, retryCount, lastError, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)`,
    [id, entity, recordId, operation, JSON.stringify(payload), now, now],
  );
  return id;
};

export const fetchLocalRecord = async (
  table: SyncableTable | string,
  id: string,
): Promise<Record<string, unknown> | null> => {
  const database = getDatabase();
  const row = await database.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE id = ?`,
    [id],
  );
  return row || null;
};

/**
 * Re-bases a local record's ID to a new one (e.g. from Supabase).
 * Used for conflict resolution when a remote record with a different ID already exists but matches a unique constraint.
 */
export const rebaseLocalRecordId = async (
  table: string,
  oldId: string,
  newId: string,
): Promise<void> => {
  const database = getDatabase();

  // 1. Check if newId already exists locally
  const targetExists = await database.getFirstAsync(`SELECT id FROM ${table} WHERE id = ?`, [
    newId,
  ]);

  await database.withTransactionAsync(async () => {
    // Defer FK enforcement to COMMIT so we can reorder parent/child updates freely
    // within the transaction without hitting intermediate constraint violations.
    await database.runAsync('PRAGMA defer_foreign_keys = ON');

    if (targetExists) {
      // Merge path: newId already exists locally.
      // Move all child references to newId FIRST (newId is a valid parent),
      // THEN delete the now-orphan oldId row.
      if (table === 'accounts') {
        await database.runAsync('UPDATE transactions SET accountId = ? WHERE accountId = ?', [
          newId,
          oldId,
        ]);
        await database.runAsync('UPDATE transactions SET toAccountId = ? WHERE toAccountId = ?', [
          newId,
          oldId,
        ]);
        await database.runAsync('UPDATE goals SET accountId = ? WHERE accountId = ?', [
          newId,
          oldId,
        ]);
        await database.runAsync(
          'UPDATE recurring_templates SET accountId = ? WHERE accountId = ?',
          [newId, oldId],
        );
      } else if (table === 'categories') {
        await database.runAsync('UPDATE transactions SET categoryId = ? WHERE categoryId = ?', [
          newId,
          oldId,
        ]);
        await database.runAsync('UPDATE budgets SET categoryId = ? WHERE categoryId = ?', [
          newId,
          oldId,
        ]);
        await database.runAsync(
          'UPDATE recurring_templates SET categoryId = ? WHERE categoryId = ?',
          [newId, oldId],
        );
      }
      await database.runAsync(`DELETE FROM ${table} WHERE id = ?`, [oldId]);
    } else {
      // Rename path: newId does not exist locally yet.
      // With defer_foreign_keys ON, SQLite checks FKs at COMMIT, so it is safe
      // to rename the parent ID then update children within the same transaction.
      await database.runAsync(`UPDATE ${table} SET id = ? WHERE id = ?`, [newId, oldId]);
      if (table === 'accounts') {
        await database.runAsync('UPDATE transactions SET accountId = ? WHERE accountId = ?', [
          newId,
          oldId,
        ]);
        await database.runAsync('UPDATE transactions SET toAccountId = ? WHERE toAccountId = ?', [
          newId,
          oldId,
        ]);
        await database.runAsync('UPDATE goals SET accountId = ? WHERE accountId = ?', [
          newId,
          oldId,
        ]);
        await database.runAsync(
          'UPDATE recurring_templates SET accountId = ? WHERE accountId = ?',
          [newId, oldId],
        );
      } else if (table === 'categories') {
        await database.runAsync('UPDATE transactions SET categoryId = ? WHERE categoryId = ?', [
          newId,
          oldId,
        ]);
        await database.runAsync('UPDATE budgets SET categoryId = ? WHERE categoryId = ?', [
          newId,
          oldId,
        ]);
        await database.runAsync(
          'UPDATE recurring_templates SET categoryId = ? WHERE categoryId = ?',
          [newId, oldId],
        );
      }
    }
  });
};

export const markRecordSyncStatus = async (
  table: SyncableTable,
  id: string,
  syncStatus: SyncStatus,
  lastSyncedAt?: string | null,
) => {
  const database = getDatabase();
  await database.runAsync(
    `UPDATE ${table} SET syncStatus = ?, lastSyncedAt = COALESCE(?, lastSyncedAt) WHERE id = ?`,
    [syncStatus, lastSyncedAt ?? null, id],
  );
};

export const removeFromSyncQueue = async (queueId: string) => {
  await getDatabase().runAsync('DELETE FROM sync_queue WHERE id = ?', [queueId]);
};

export const listPendingSyncItems = async (): Promise<SyncQueueItem[]> =>
  getDatabase().getAllAsync<SyncQueueItem>(
    `SELECT * FROM sync_queue
     WHERE retryCount < 5
     ORDER BY createdAt ASC`,
  );

export const incrementSyncRetry = async (queueId: string, errorMessage: string) => {
  const now = new Date().toISOString();
  await getDatabase().runAsync(
    `UPDATE sync_queue
     SET retryCount = retryCount + 1, lastError = ?, updatedAt = ?
     WHERE id = ?`,
    [errorMessage, now, queueId],
  );
};

export const setSyncState = async (key: string, value: string) => {
  const now = new Date().toISOString();
  await getDatabase().runAsync(
    `INSERT INTO sync_state (key, value, updatedAt)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
    [key, value, now],
  );
};

export const getSyncState = async (key: string) => {
  const row = await getDatabase().getFirstAsync<{ value: string }>(
    'SELECT value FROM sync_state WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
};

export const fetchTableRows = async <T>(
  table: SyncableTable,
  where = 'deletedAt IS NULL',
  params: SQLite.SQLiteBindParams = [],
) => getDatabase().getAllAsync<T>(`SELECT * FROM ${table} WHERE ${where}`, params);

export const upsertLocalRecord = async (table: SyncableTable, record: Record<string, unknown>) => {
  const database = getDatabase();
  const columns = Object.keys(record);
  const placeholders = columns.map(() => '?').join(', ');
  const updateSet = columns
    .filter((column) => column !== 'id')
    .map((column) => `${column} = excluded.${column}`)
    .join(', ');

  await database.runAsync(
    `INSERT INTO ${table} (${columns.join(', ')})
     VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${updateSet}`,
    columns.map((column) => normalizeBindValue(record[column])),
  );
};

export const softDeleteLocalRecord = async (
  table: SyncableTable,
  id: string,
  deletedAt: string,
) => {
  await getDatabase().runAsync(
    `UPDATE ${table}
     SET deletedAt = ?, updatedAt = ?, syncStatus = 'synced', lastSyncedAt = ?
     WHERE id = ?`,
    [deletedAt, deletedAt, deletedAt, id],
  );
};

export const getLastSyncTimestamp = async () => getSyncState('lastSuccessfulSyncAt');

export const setLastSyncTimestamp = async (timestamp: string) =>
  setSyncState('lastSuccessfulSyncAt', timestamp);

export const getSyncableTables = (): readonly SyncableTable[] => SYNCABLE_TABLES;

export const hasLocalUserData = async (userId: string | null): Promise<boolean> => {
  const database = getDatabase();

  const userScopedTables = [
    'user_profile',
    'accounts',
    'transactions',
    'budgets',
    'goals',
    'assets',
    'liabilities',
    'net_worth_history',
    'recurring_templates',
    'split_expenses',
    'split_members',
    'notes',
  ] as const;

  for (const table of userScopedTables) {
    const row = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${table} WHERE deletedAt IS NULL AND userId = ?`,
      [userId],
    );
    if ((row?.count ?? 0) > 0) {
      return true;
    }
  }

  const customCategoryCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories WHERE deletedAt IS NULL AND isCustom = 1 AND userId = ?',
    [userId],
  );
  if ((customCategoryCount?.count ?? 0) > 0) {
    return true;
  }

  const customPaymentMethodCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM payment_methods WHERE deletedAt IS NULL AND isCustom = 1 AND userId = ?',
    [userId],
  );
  return (customPaymentMethodCount?.count ?? 0) > 0;
};

export const clearLocalData = async (): Promise<void> => {
  const database = getDatabase();
  await database.execAsync('BEGIN IMMEDIATE TRANSACTION;');

  try {
    for (const table of localTablesToClear) {
      await database.execAsync(`DELETE FROM ${table};`);
    }
    await database.execAsync('COMMIT;');
    await seedDefaultData(database);
  } catch (error) {
    await database.execAsync('ROLLBACK;');
    throw error;
  }
};
