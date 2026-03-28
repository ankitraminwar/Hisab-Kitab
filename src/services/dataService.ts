import type { SQLiteBindValue } from 'expo-sqlite';
import { enqueueSync, getDatabase } from '../database';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import { generateId } from '../utils/constants';
import type {
  Account,
  Asset,
  Budget,
  Category,
  Goal,
  Liability,
  NetWorthHistory,
  UserProfile,
} from '../utils/types';
import { triggerBackgroundSync } from './syncService';

const bindValue = (value: unknown): SQLiteBindValue => {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Uint8Array
  ) {
    return (value ?? null) as SQLiteBindValue;
  }

  return JSON.stringify(value);
};

const createSyncMetadata = () => ({
  userId: null,
  syncStatus: 'pending' as const,
  lastSyncedAt: null,
  deletedAt: null,
});

const parseBudget = (row: Budget): Budget => ({
  ...row,
  limitAmount: Number(row.limitAmount) || 0,
  spent: Number(row.spent) || 0,
});

const queueEntitySync = async (
  table: string,
  id: string,
  payload: Record<string, unknown>,
  operation: 'upsert' | 'delete' = 'upsert',
) => {
  await enqueueSync(table, id, operation, payload);
  useAppStore.getState().bumpDataRevision();
  triggerBackgroundSync(`${table}-${operation}`).catch(console.warn);
};

export const AccountService = {
  async getAll(): Promise<Account[]> {
    try {
      const db = getDatabase();
      let rows = await db.getAllAsync<Account>(
        'SELECT * FROM accounts WHERE deletedAt IS NULL ORDER BY isDefault DESC, name ASC',
      );

      // Emergency seed if empty (ensure at least one account exists)
      if (rows.length === 0) {
        const { seedDefaultData } = await import('../database');
        await seedDefaultData(db);
        rows = await db.getAllAsync<Account>(
          'SELECT * FROM accounts WHERE deletedAt IS NULL ORDER BY isDefault DESC, name ASC',
        );
      }

      const accounts = rows.map((row) => ({
        ...row,
        isDefault: Boolean(row.isDefault),
      }));

      return accounts;
    } catch (e) {
      console.error('[AccountService] Failed to fetch accounts:', e);
      return [];
    }
  },

  async create(
    data: Omit<
      Account,
      'id' | 'createdAt' | 'updatedAt' | 'userId' | 'syncStatus' | 'lastSyncedAt' | 'deletedAt'
    >,
  ): Promise<Account> {
    const now = new Date().toISOString();
    const account: Account = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      ...createSyncMetadata(),
    };

    await getDatabase().runAsync(
      `INSERT INTO accounts
        (id, name, type, balance, currency, color, icon, isDefault, createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        account.id,
        account.name,
        account.type,
        account.balance,
        account.currency,
        account.color,
        account.icon,
        account.isDefault ? 1 : 0,
        account.createdAt,
        account.updatedAt,
        bindValue(account.userId),
        account.syncStatus,
        bindValue(account.lastSyncedAt),
        bindValue(account.deletedAt),
      ],
    );

    await queueEntitySync('accounts', account.id, {
      ...account,
      isDefault: account.isDefault ? 1 : 0,
    } as Record<string, unknown>);
    return account;
  },

  async update(id: string, data: Partial<Account>) {
    const existing = await getDatabase().getFirstAsync<Account>(
      'SELECT * FROM accounts WHERE id = ?',
      [id],
    );
    if (!existing) {
      throw new Error('Account not found');
    }

    const updatedAt = new Date().toISOString();
    const account = {
      ...existing,
      ...data,
      updatedAt,
      syncStatus: 'pending' as const,
    };

    await getDatabase().runAsync(
      `UPDATE accounts
       SET name = ?, type = ?, balance = ?, currency = ?, color = ?, icon = ?, isDefault = ?, updatedAt = ?, syncStatus = 'pending'
       WHERE id = ?`,
      [
        account.name,
        account.type,
        account.balance,
        account.currency,
        account.color,
        account.icon,
        account.isDefault ? 1 : 0,
        account.updatedAt,
        id,
      ],
    );

    await queueEntitySync('accounts', id, {
      ...account,
      isDefault: account.isDefault ? 1 : 0,
    } as Record<string, unknown>);
  },

  async delete(id: string) {
    const deletedAt = new Date().toISOString();
    await getDatabase().runAsync(
      `UPDATE accounts SET deletedAt = ?, updatedAt = ?, syncStatus = 'pending' WHERE id = ?`,
      [deletedAt, deletedAt, id],
    );
    await queueEntitySync('accounts', id, { id, deletedAt, updatedAt: deletedAt }, 'delete');
  },

  async getTotalBalance(): Promise<number> {
    const row = await getDatabase().getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(balance), 0) as total FROM accounts WHERE deletedAt IS NULL',
    );
    return row?.total ?? 0;
  },
};

export const CategoryService = {
  async getAll(): Promise<Category[]> {
    try {
      const db = getDatabase();
      let rows = await db.getAllAsync<Omit<Category, 'isCustom'> & { isCustom: number | null }>(
        'SELECT * FROM categories WHERE deletedAt IS NULL ORDER BY isCustom ASC, name ASC',
      );

      // Emergency seed if empty (safety net for interrupted init)
      if (rows.length === 0) {
        const { seedDefaultData } = await import('../database');
        await seedDefaultData(db);
        rows = await db.getAllAsync<Omit<Category, 'isCustom'> & { isCustom: number | null }>(
          'SELECT * FROM categories WHERE deletedAt IS NULL ORDER BY isCustom ASC, name ASC',
        );
      }

      const categories = rows.map((row) => ({
        ...row,
        isCustom: row.isCustom === 1,
      }));

      return categories;
    } catch (e) {
      console.error('[CategoryService] Failed to fetch categories:', e);
      return [];
    }
  },

  async create(data: Pick<Category, 'name' | 'type' | 'icon' | 'color'>) {
    const now = new Date().toISOString();
    const category: Category = {
      ...data,
      id: generateId(),
      isCustom: true,
      createdAt: now,
      updatedAt: now,
      ...createSyncMetadata(),
    };

    await getDatabase().runAsync(
      `INSERT INTO categories
        (id, name, type, icon, color, isCustom, parentId, createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
       VALUES (?, ?, ?, ?, ?, 1, NULL, ?, ?, ?, ?, ?, ?)`,
      [
        category.id,
        category.name,
        category.type,
        category.icon,
        category.color,
        category.createdAt,
        category.updatedAt,
        bindValue(category.userId),
        category.syncStatus,
        bindValue(category.lastSyncedAt),
        bindValue(category.deletedAt),
      ],
    );

    await queueEntitySync(
      'categories',
      category.id,
      category as unknown as Record<string, unknown>,
    );
    return category.id;
  },

  async update(id: string, data: Partial<Pick<Category, 'name' | 'type' | 'icon' | 'color'>>) {
    const existing = await getDatabase().getFirstAsync<Category>(
      'SELECT * FROM categories WHERE id = ?',
      [id],
    );
    if (!existing) {
      throw new Error('Category not found');
    }

    const updatedAt = new Date().toISOString();
    const category = {
      ...existing,
      ...data,
      updatedAt,
      syncStatus: 'pending' as const,
    };

    await getDatabase().runAsync(
      `UPDATE categories
       SET name = ?, type = ?, icon = ?, color = ?, updatedAt = ?, syncStatus = 'pending'
       WHERE id = ?`,
      [category.name, category.type, category.icon, category.color, updatedAt, id],
    );

    await queueEntitySync('categories', id, category as unknown as Record<string, unknown>);
  },

  async delete(id: string) {
    const deletedAt = new Date().toISOString();
    await getDatabase().runAsync(
      `UPDATE categories SET deletedAt = ?, updatedAt = ?, syncStatus = 'pending' WHERE id = ?`,
      [deletedAt, deletedAt, id],
    );
    await queueEntitySync('categories', id, { id, deletedAt, updatedAt: deletedAt }, 'delete');
  },
};

export const BudgetService = {
  async getForMonth(year: number, month: string): Promise<Budget[]> {
    const rows = await getDatabase().getAllAsync<Budget>(
      `SELECT b.*,
              c.name as categoryName,
              c.icon as categoryIcon,
              c.color as categoryColor,
              COALESCE(SUM(t.amount), 0) as spent
       FROM budgets b
       LEFT JOIN categories c ON b.categoryId = c.id
       LEFT JOIN transactions t ON t.categoryId = b.categoryId
         AND t.type = 'expense'
         AND t.deletedAt IS NULL
         AND strftime('%Y', t.date) = CAST(b.year AS TEXT)
         AND strftime('%m', t.date) = b.month
       WHERE b.year = ? AND b.month = ? AND b.deletedAt IS NULL
       GROUP BY b.id
       ORDER BY c.name ASC`,
      [year, month],
    );
    return rows.map(parseBudget);
  },

  async create(
    data: Omit<
      Budget,
      | 'id'
      | 'spent'
      | 'createdAt'
      | 'updatedAt'
      | 'userId'
      | 'syncStatus'
      | 'lastSyncedAt'
      | 'deletedAt'
    >,
  ) {
    const now = new Date().toISOString();
    const budget: Budget = {
      ...data,
      id: generateId(),
      spent: 0,
      createdAt: now,
      updatedAt: now,
      ...createSyncMetadata(),
    };

    await getDatabase().runAsync(
      `INSERT INTO budgets
        (id, categoryId, limitAmount, spent, month, year, alertAt, createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        budget.id,
        budget.categoryId,
        budget.limitAmount,
        budget.spent,
        budget.month,
        budget.year,
        budget.alertAt,
        budget.createdAt,
        budget.updatedAt,
        bindValue(budget.userId),
        budget.syncStatus,
        bindValue(budget.lastSyncedAt),
        bindValue(budget.deletedAt),
      ],
    );

    await queueEntitySync('budgets', budget.id, budget as unknown as Record<string, unknown>);
    return budget.id;
  },

  async update(id: string, data: Partial<Pick<Budget, 'limitAmount' | 'alertAt'>>) {
    const existingRow = await getDatabase().getFirstAsync<Budget>(
      'SELECT * FROM budgets WHERE id = ?',
      [id],
    );
    if (!existingRow) {
      throw new Error('Budget not found');
    }

    const existing = parseBudget(existingRow);

    const updatedAt = new Date().toISOString();
    const budget = {
      ...existing,
      ...data,
      updatedAt,
      syncStatus: 'pending' as const,
    };

    await getDatabase().runAsync(
      `UPDATE budgets
       SET limitAmount = COALESCE(?, limitAmount), alertAt = COALESCE(?, alertAt), updatedAt = ?, syncStatus = 'pending'
       WHERE id = ?`,
      [data.limitAmount ?? null, data.alertAt ?? null, updatedAt, id],
    );

    await queueEntitySync('budgets', id, budget as unknown as Record<string, unknown>);
  },

  async delete(id: string) {
    const deletedAt = new Date().toISOString();
    await getDatabase().runAsync(
      `UPDATE budgets SET deletedAt = ?, updatedAt = ?, syncStatus = 'pending' WHERE id = ?`,
      [deletedAt, deletedAt, id],
    );
    await queueEntitySync('budgets', id, { id, deletedAt, updatedAt: deletedAt }, 'delete');
  },
};

export const GoalService = {
  async getAll(): Promise<Goal[]> {
    const rows = await getDatabase().getAllAsync<Goal>(
      'SELECT * FROM goals WHERE deletedAt IS NULL ORDER BY isCompleted ASC, createdAt DESC',
    );
    return rows.map((row) => ({
      ...row,
      isCompleted: Boolean(row.isCompleted),
    }));
  },

  async create(
    data: Omit<
      Goal,
      'id' | 'createdAt' | 'updatedAt' | 'userId' | 'syncStatus' | 'lastSyncedAt' | 'deletedAt'
    >,
  ) {
    const now = new Date().toISOString();
    const goal: Goal = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      ...createSyncMetadata(),
    };

    await getDatabase().runAsync(
      `INSERT INTO goals
        (id, name, targetAmount, currentAmount, deadline, icon, color, accountId, isCompleted, createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        goal.id,
        goal.name,
        goal.targetAmount,
        goal.currentAmount,
        bindValue(goal.deadline),
        goal.icon,
        goal.color,
        bindValue(goal.accountId),
        goal.isCompleted ? 1 : 0,
        goal.createdAt,
        goal.updatedAt,
        bindValue(goal.userId),
        goal.syncStatus,
        bindValue(goal.lastSyncedAt),
        bindValue(goal.deletedAt),
      ],
    );

    await queueEntitySync('goals', goal.id, {
      ...goal,
      isCompleted: goal.isCompleted ? 1 : 0,
    } as Record<string, unknown>);
    return goal.id;
  },

  async addFunds(id: string, amount: number) {
    const existing = await getDatabase().getFirstAsync<Goal>('SELECT * FROM goals WHERE id = ?', [
      id,
    ]);
    if (!existing) {
      throw new Error('Goal not found');
    }

    const updatedAt = new Date().toISOString();
    const currentAmount = Math.min(existing.currentAmount + amount, existing.targetAmount);
    const isCompleted = currentAmount >= existing.targetAmount;

    await getDatabase().runAsync(
      `UPDATE goals
       SET currentAmount = ?, isCompleted = ?, updatedAt = ?, syncStatus = 'pending'
       WHERE id = ?`,
      [currentAmount, isCompleted ? 1 : 0, updatedAt, id],
    );

    await queueEntitySync('goals', id, {
      ...existing,
      currentAmount,
      isCompleted: isCompleted ? 1 : 0,
      updatedAt,
      syncStatus: 'pending',
    } as Record<string, unknown>);
  },

  async update(
    id: string,
    data: Partial<Pick<Goal, 'name' | 'targetAmount' | 'deadline' | 'icon' | 'color'>>,
  ) {
    const existing = await getDatabase().getFirstAsync<Goal>('SELECT * FROM goals WHERE id = ?', [
      id,
    ]);
    if (!existing) throw new Error('Goal not found');

    const updatedAt = new Date().toISOString();
    const goal = { ...existing, ...data, updatedAt, syncStatus: 'pending' as const };

    await getDatabase().runAsync(
      `UPDATE goals
       SET name = ?, targetAmount = ?, deadline = ?, icon = ?, color = ?, updatedAt = ?, syncStatus = 'pending'
       WHERE id = ?`,
      [
        goal.name,
        goal.targetAmount,
        goal.deadline ?? null,
        goal.icon ?? null,
        goal.color ?? null,
        updatedAt,
        id,
      ],
    );

    await queueEntitySync('goals', id, {
      ...goal,
      isCompleted: goal.isCompleted ? 1 : 0,
    } as Record<string, unknown>);
  },

  async delete(id: string) {
    const deletedAt = new Date().toISOString();
    await getDatabase().runAsync(
      `UPDATE goals SET deletedAt = ?, updatedAt = ?, syncStatus = 'pending' WHERE id = ?`,
      [deletedAt, deletedAt, id],
    );
    await queueEntitySync('goals', id, { id, deletedAt, updatedAt: deletedAt }, 'delete');
  },
};

export const NetWorthService = {
  async getAssets(): Promise<Asset[]> {
    return getDatabase().getAllAsync<Asset>(
      'SELECT * FROM assets WHERE deletedAt IS NULL ORDER BY value DESC',
    );
  },

  async getLiabilities(): Promise<Liability[]> {
    return getDatabase().getAllAsync<Liability>(
      'SELECT * FROM liabilities WHERE deletedAt IS NULL ORDER BY amount DESC',
    );
  },

  async getNetWorth(): Promise<{
    assets: number;
    liabilities: number;
    netWorth: number;
  }> {
    const assets = await getDatabase().getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(value), 0) as total FROM assets WHERE deletedAt IS NULL',
    );
    const liabilities = await getDatabase().getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(amount), 0) as total FROM liabilities WHERE deletedAt IS NULL',
    );

    const totalAssets = assets?.total ?? 0;
    const totalLiabilities = liabilities?.total ?? 0;
    return {
      assets: totalAssets,
      liabilities: totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
    };
  },

  async saveNetWorthSnapshot() {
    const now = new Date().toISOString();
    const totals = await this.getNetWorth();
    const snapshot: NetWorthHistory = {
      id: generateId(),
      totalAssets: totals.assets,
      totalLiabilities: totals.liabilities,
      netWorth: totals.netWorth,
      date: now.slice(0, 10),
      createdAt: now,
      updatedAt: now,
      ...createSyncMetadata(),
    };

    await getDatabase().runAsync(
      `INSERT INTO net_worth_history
        (id, totalAssets, totalLiabilities, netWorth, date, createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        snapshot.id,
        snapshot.totalAssets,
        snapshot.totalLiabilities,
        snapshot.netWorth,
        snapshot.date,
        snapshot.createdAt,
        snapshot.updatedAt,
        bindValue(snapshot.userId),
        snapshot.syncStatus,
        bindValue(snapshot.lastSyncedAt),
        bindValue(snapshot.deletedAt),
      ],
    );

    await queueEntitySync(
      'net_worth_history',
      snapshot.id,
      snapshot as unknown as Record<string, unknown>,
    );
  },

  async getNetWorthHistory(months = 12): Promise<NetWorthHistory[]> {
    return getDatabase().getAllAsync<NetWorthHistory>(
      `SELECT * FROM net_worth_history
       WHERE deletedAt IS NULL AND date >= date('now', ?)
       ORDER BY date ASC`,
      [`-${months} months`],
    );
  },

  async createAsset(
    data: Omit<
      Asset,
      'id' | 'createdAt' | 'updatedAt' | 'userId' | 'syncStatus' | 'lastSyncedAt' | 'deletedAt'
    >,
  ) {
    const now = new Date().toISOString();
    const asset: Asset = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      ...createSyncMetadata(),
    };

    await getDatabase().runAsync(
      `INSERT INTO assets
        (id, name, type, value, notes, lastUpdated, createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        asset.id,
        asset.name,
        asset.type,
        asset.value,
        bindValue(asset.notes),
        asset.lastUpdated,
        asset.createdAt,
        asset.updatedAt,
        bindValue(asset.userId),
        asset.syncStatus,
        bindValue(asset.lastSyncedAt),
        bindValue(asset.deletedAt),
      ],
    );

    await queueEntitySync('assets', asset.id, asset as unknown as Record<string, unknown>);
    return asset.id;
  },

  async createLiability(
    data: Omit<
      Liability,
      'id' | 'createdAt' | 'updatedAt' | 'userId' | 'syncStatus' | 'lastSyncedAt' | 'deletedAt'
    >,
  ) {
    const now = new Date().toISOString();
    const liability: Liability = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      ...createSyncMetadata(),
    };

    await getDatabase().runAsync(
      `INSERT INTO liabilities
        (id, name, type, amount, interestRate, dueDate, notes, lastUpdated, createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        liability.id,
        liability.name,
        liability.type,
        liability.amount,
        liability.interestRate,
        bindValue(liability.dueDate),
        bindValue(liability.notes),
        liability.lastUpdated,
        liability.createdAt,
        liability.updatedAt,
        bindValue(liability.userId),
        liability.syncStatus,
        bindValue(liability.lastSyncedAt),
        bindValue(liability.deletedAt),
      ],
    );

    await queueEntitySync(
      'liabilities',
      liability.id,
      liability as unknown as Record<string, unknown>,
    );
    return liability.id;
  },

  async deleteAsset(id: string) {
    const deletedAt = new Date().toISOString();
    await getDatabase().runAsync(
      `UPDATE assets SET deletedAt = ?, updatedAt = ?, syncStatus = 'pending' WHERE id = ?`,
      [deletedAt, deletedAt, id],
    );
    await queueEntitySync('assets', id, { id, deletedAt, updatedAt: deletedAt }, 'delete');
  },

  async deleteLiability(id: string) {
    const deletedAt = new Date().toISOString();
    await getDatabase().runAsync(
      `UPDATE liabilities SET deletedAt = ?, updatedAt = ?, syncStatus = 'pending' WHERE id = ?`,
      [deletedAt, deletedAt, id],
    );
    await queueEntitySync('liabilities', id, { id, deletedAt, updatedAt: deletedAt }, 'delete');
  },
};

export const DataService = {
  async exportAllData() {
    const tables = [
      'accounts',
      'categories',
      'transactions',
      'budgets',
      'goals',
      'assets',
      'liabilities',
      'net_worth_history',
      'notes',
      'split_expenses',
      'split_members',
      'split_friends',
      'payment_methods',
      'recurring_templates',
    ];

    const result: Record<string, unknown[]> = {};
    const syncColumns = new Set([
      'syncStatus',
      'lastSyncedAt',
      'userId',
      'deletedAt',
      'sync_status',
      'last_synced_at',
      'user_id',
      'deleted_at',
    ]);

    for (const table of tables) {
      const rows = await getDatabase().getAllAsync<Record<string, unknown>>(
        `SELECT * FROM ${table} WHERE deletedAt IS NULL`,
      );

      // Map rows to exclude sync metadata
      result[table] = rows.map((row) => {
        return Object.fromEntries(Object.entries(row).filter(([key]) => !syncColumns.has(key)));
      });
    }

    return result;
  },

  /** Import a full backup JSON (exported via exportAllData). Inserts rows using INSERT OR REPLACE. */
  async importAllData(data: Record<string, unknown[]>): Promise<{ imported: number }> {
    const validTables = [
      'accounts',
      'categories',
      'transactions',
      'budgets',
      'goals',
      'assets',
      'liabilities',
      'net_worth_history',
      'notes',
      'split_expenses',
      'split_members',
      'split_friends',
      'payment_methods',
      'recurring_templates',
    ];

    let imported = 0;
    const db = getDatabase();

    // Build column whitelist per table from SQLite schema
    const schemaCache = new Map<string, Set<string>>();
    const syncColumns = new Set([
      'syncStatus',
      'lastSyncedAt',
      'userId',
      'sync_status',
      'last_synced_at',
    ]);

    for (const table of validTables) {
      const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
      schemaCache.set(table, new Set(cols.map((c) => c.name)));
    }

    try {
      await db.execAsync('BEGIN TRANSACTION');

      for (const table of validTables) {
        const rows = data[table];
        if (!Array.isArray(rows) || rows.length === 0) continue;

        const allowedColumnsSet = schemaCache.get(table)!;
        // Finding 7: Protect sync fields from being overwritten during import
        const keysToImport = Array.from(allowedColumnsSet).filter((col) => !syncColumns.has(col));

        for (const row of rows) {
          if (typeof row !== 'object' || row === null) continue;
          const record = row as Record<string, unknown>;

          // Only keep keys that exist in the import payload AND are in our import-safe whitelist
          const keys = keysToImport.filter((k) => k in record);
          if (keys.length === 0) continue;

          const placeholders = keys.map(() => '?').join(', ');
          const values = keys.map((k) => {
            const v = record[k];
            if (v === null || v === undefined) return null;
            if (typeof v === 'boolean') return v ? 1 : 0;
            return v;
          });

          await db.runAsync(
            `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
            values as (string | number | null)[],
          );
          imported++;
        }
      }

      await db.execAsync('COMMIT');
    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }

    useAppStore.getState().bumpDataRevision();
    return { imported };
  },
};

const parseUserProfile = (
  row: UserProfile & {
    notificationsEnabled: number | boolean;
    biometricEnabled: number | boolean;
  },
): UserProfile => ({
  ...row,
  notificationsEnabled: Boolean(row.notificationsEnabled),
  biometricEnabled: Boolean(row.biometricEnabled),
});

export const UserProfileService = {
  async getProfile(): Promise<UserProfile | null> {
    const session = await supabase.auth.getSession();
    const sessionUserId = session.data.session?.user?.id ?? null;

    const row = await getDatabase().getFirstAsync<
      UserProfile & { notificationsEnabled: number; biometricEnabled: number }
    >(
      sessionUserId
        ? 'SELECT * FROM user_profile WHERE userId = ? LIMIT 1'
        : 'SELECT * FROM user_profile LIMIT 1',
      sessionUserId ? [sessionUserId] : [],
    );

    return row ? parseUserProfile(row) : null;
  },

  async upsertProfile(
    data: Partial<Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>>,
  ): Promise<UserProfile> {
    const session = await supabase.auth.getSession();
    const sessionUserId = session.data.session?.user?.id ?? null;
    const sessionEmail = session.data.session?.user?.email ?? '';
    const existing = await this.getProfile();
    const sessionName = session.data.session?.user?.user_metadata?.name as string | undefined;
    const now = new Date().toISOString();

    // Resolve name: only fall back to default for INSERT, not UPDATE
    const resolvedName = data.name?.trim() || existing?.name?.trim() || sessionName?.trim() || null;

    const profile: UserProfile = {
      id: existing?.id ?? sessionUserId ?? 'profile_local',
      name: resolvedName ?? (existing ? existing.name : 'Hisab Kitab User'),
      email: data.email ?? existing?.email ?? sessionEmail,
      phone: data.phone ?? existing?.phone,
      currency: data.currency ?? existing?.currency ?? 'INR',
      monthlyBudget: data.monthlyBudget ?? existing?.monthlyBudget ?? 0,
      avatar: data.avatar ?? existing?.avatar ?? undefined,
      themePreference: data.themePreference ?? existing?.themePreference ?? 'system',
      notificationsEnabled: data.notificationsEnabled ?? existing?.notificationsEnabled ?? false,
      biometricEnabled: data.biometricEnabled ?? existing?.biometricEnabled ?? false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      userId: data.userId ?? existing?.userId ?? sessionUserId,
      syncStatus: 'pending',
      lastSyncedAt: existing?.lastSyncedAt ?? null,
      deletedAt: null,
    };

    await getDatabase().runAsync(
      `INSERT INTO user_profile
        (id, name, email, phone, avatar, currency, monthlyBudget, themePreference, notificationsEnabled, biometricEnabled, createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         email = excluded.email,
         phone = excluded.phone,
         avatar = excluded.avatar,
         currency = excluded.currency,
         monthlyBudget = excluded.monthlyBudget,
         themePreference = excluded.themePreference,
         notificationsEnabled = excluded.notificationsEnabled,
         biometricEnabled = excluded.biometricEnabled,
         updatedAt = excluded.updatedAt,
         userId = excluded.userId,
         syncStatus = excluded.syncStatus,
         deletedAt = excluded.deletedAt`,
      [
        profile.id,
        profile.name,
        profile.email,
        bindValue(profile.phone),
        bindValue(profile.avatar),
        profile.currency,
        profile.monthlyBudget,
        profile.themePreference,
        profile.notificationsEnabled ? 1 : 0,
        profile.biometricEnabled ? 1 : 0,
        profile.createdAt,
        profile.updatedAt,
        bindValue(profile.userId),
        profile.syncStatus,
        bindValue(profile.lastSyncedAt),
        bindValue(profile.deletedAt),
      ],
    );

    await queueEntitySync('user_profile', profile.id, {
      ...profile,
      notificationsEnabled: profile.notificationsEnabled ? 1 : 0,
      biometricEnabled: profile.biometricEnabled ? 1 : 0,
    } as Record<string, unknown>);

    return profile;
  },
};

export const PaymentMethodService = {
  async getAll(): Promise<{ id: string; name: string; icon: string; isCustom: boolean }[]> {
    const rows = await getDatabase().getAllAsync<{
      id: string;
      name: string;
      icon: string;
      isCustom: number;
    }>('SELECT * FROM payment_methods WHERE deletedAt IS NULL ORDER BY isCustom ASC, name ASC');

    const methods = rows.map((row) => ({ ...row, isCustom: Boolean(row.isCustom) }));

    const seen = new Set<string>();
    return methods.filter((m) => {
      if (seen.has(m.name)) return false;
      seen.add(m.name);
      return true;
    });
  },

  async create(name: string, icon = 'card'): Promise<string> {
    const now = new Date().toISOString();
    const id = generateId();
    await getDatabase().runAsync(
      `INSERT INTO payment_methods (id, name, icon, isCustom, createdAt, updatedAt, syncStatus)
       VALUES (?, ?, ?, 1, ?, ?, 'pending')`,
      [id, name, icon, now, now],
    );
    await queueEntitySync('payment_methods', id, {
      id,
      name,
      icon,
      isCustom: 1,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
};
