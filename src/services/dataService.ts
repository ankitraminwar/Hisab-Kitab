import { getDatabase, enqueueSync } from '@/database';
import type { SQLiteBindValue } from 'expo-sqlite';
import { generateId } from '@/utils/constants';
import type {
  Account,
  Asset,
  Budget,
  Category,
  Goal,
  Liability,
  NetWorthHistory,
} from '@/utils/types';

const bindValue = (value: unknown): SQLiteBindValue => {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Uint8Array
  ) {
    return value ?? null;
  }

  return JSON.stringify(value);
};

const createSyncMetadata = () => ({
  userId: null,
  syncStatus: 'pending' as const,
  lastSyncedAt: null,
  deletedAt: null,
});

const queueEntitySync = async (
  table: string,
  id: string,
  payload: Record<string, unknown>,
  operation: 'upsert' | 'delete' = 'upsert',
) => enqueueSync(table, id, operation, payload);

export const AccountService = {
  async getAll(): Promise<Account[]> {
    const rows = await getDatabase().getAllAsync<Account>(
      'SELECT * FROM accounts WHERE deletedAt IS NULL ORDER BY isDefault DESC, name ASC',
    );
    return rows.map((row) => ({ ...row, isDefault: Boolean(row.isDefault) }));
  },

  async create(data: Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'syncStatus' | 'lastSyncedAt' | 'deletedAt'>): Promise<Account> {
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

    await queueEntitySync('accounts', account.id, { ...account, isDefault: account.isDefault ? 1 : 0 } as Record<string, unknown>);
    return account;
  },

  async update(id: string, data: Partial<Account>) {
    const existing = await getDatabase().getFirstAsync<Account>('SELECT * FROM accounts WHERE id = ?', [id]);
    if (!existing) {
      throw new Error('Account not found');
    }

    const updatedAt = new Date().toISOString();
    const account = { ...existing, ...data, updatedAt, syncStatus: 'pending' as const };

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

    await queueEntitySync('accounts', id, { ...account, isDefault: account.isDefault ? 1 : 0 } as Record<string, unknown>);
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
    return getDatabase().getAllAsync<Category>(
      'SELECT * FROM categories WHERE deletedAt IS NULL ORDER BY isCustom ASC, name ASC',
    );
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

    await queueEntitySync('categories', category.id, category as unknown as Record<string, unknown>);
    return category.id;
  },
};

export const BudgetService = {
  async getForMonth(year: number, month: string): Promise<Budget[]> {
    return getDatabase().getAllAsync<Budget>(
      `SELECT b.*, c.name as categoryName, c.icon as categoryIcon, c.color as categoryColor
       FROM budgets b
       LEFT JOIN categories c ON b.categoryId = c.id
       WHERE b.year = ? AND b.month = ? AND b.deletedAt IS NULL
       ORDER BY c.name ASC`,
      [year, month],
    );
  },

  async create(data: Omit<Budget, 'id' | 'spent' | 'createdAt' | 'updatedAt' | 'userId' | 'syncStatus' | 'lastSyncedAt' | 'deletedAt'>) {
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
        (id, categoryId, limit_amount, spent, month, year, alertAt, createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        budget.id,
        budget.categoryId,
        budget.limit_amount,
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
    return rows.map((row) => ({ ...row, isCompleted: Boolean(row.isCompleted) }));
  },

  async create(data: Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'syncStatus' | 'lastSyncedAt' | 'deletedAt'>) {
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

    await queueEntitySync('goals', goal.id, { ...goal, isCompleted: goal.isCompleted ? 1 : 0 } as Record<string, unknown>);
    return goal.id;
  },

  async addFunds(id: string, amount: number) {
    const existing = await getDatabase().getFirstAsync<Goal>('SELECT * FROM goals WHERE id = ?', [id]);
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

    await queueEntitySync(
      'goals',
      id,
      {
        ...existing,
        currentAmount,
        isCompleted: isCompleted ? 1 : 0,
        updatedAt,
        syncStatus: 'pending',
      } as Record<string, unknown>,
    );
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
    return getDatabase().getAllAsync<Asset>('SELECT * FROM assets WHERE deletedAt IS NULL ORDER BY value DESC');
  },

  async getLiabilities(): Promise<Liability[]> {
    return getDatabase().getAllAsync<Liability>('SELECT * FROM liabilities WHERE deletedAt IS NULL ORDER BY amount DESC');
  },

  async getNetWorth(): Promise<{ assets: number; liabilities: number; netWorth: number }> {
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

    await queueEntitySync('net_worth_history', snapshot.id, snapshot as unknown as Record<string, unknown>);
  },

  async getNetWorthHistory(months = 12): Promise<NetWorthHistory[]> {
    return getDatabase().getAllAsync<NetWorthHistory>(
      `SELECT * FROM net_worth_history
       WHERE deletedAt IS NULL AND date >= date('now', ?)
       ORDER BY date ASC`,
      [`-${months} months`],
    );
  },

  async createAsset(data: Omit<Asset, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'syncStatus' | 'lastSyncedAt' | 'deletedAt'>) {
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

  async createLiability(data: Omit<Liability, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'syncStatus' | 'lastSyncedAt' | 'deletedAt'>) {
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

    await queueEntitySync('liabilities', liability.id, liability as unknown as Record<string, unknown>);
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
    ];

    const result: Record<string, unknown[]> = {};

    for (const table of tables) {
      result[table] = await getDatabase().getAllAsync(`SELECT * FROM ${table} WHERE deletedAt IS NULL`);
    }

    return result;
  },
};
