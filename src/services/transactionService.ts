import { getDatabase, enqueueSync } from '@/database';
import type { SQLiteBindValue } from 'expo-sqlite';
import { triggerBackgroundSync } from '@/services/syncService';
import { generateId } from '@/utils/constants';
import type { Transaction, TransactionFilters, TransactionType } from '@/utils/types';

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

const parseTransaction = (row: Transaction & { tags: string | string[]; isRecurring: number | boolean }): Transaction => ({
  ...row,
  tags: Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags || '[]'),
  paymentMethod: row.paymentMethod ?? 'other',
  isRecurring: Boolean(row.isRecurring),
});

const applyBalanceEffect = async (
  type: TransactionType,
  amount: number,
  accountId: string,
  toAccountId?: string,
  reverse = false,
) => {
  const db = getDatabase();
  const now = new Date().toISOString();
  const multiplier = reverse ? -1 : 1;

  if (type === 'income') {
    await db.runAsync(
      `UPDATE accounts SET balance = balance + ?, updatedAt = ?, syncStatus = 'pending' WHERE id = ?`,
      [amount * multiplier, now, accountId],
    );
    return;
  }

  if (type === 'expense') {
    await db.runAsync(
      `UPDATE accounts SET balance = balance - ?, updatedAt = ?, syncStatus = 'pending' WHERE id = ?`,
      [amount * multiplier, now, accountId],
    );
    return;
  }

  if (type === 'transfer' && toAccountId) {
    await db.runAsync(
      `UPDATE accounts SET balance = balance - ?, updatedAt = ?, syncStatus = 'pending' WHERE id = ?`,
      [amount * multiplier, now, accountId],
    );
    await db.runAsync(
      `UPDATE accounts SET balance = balance + ?, updatedAt = ?, syncStatus = 'pending' WHERE id = ?`,
      [amount * multiplier, now, toAccountId],
    );
  }
};

export const TransactionService = {
  async getAll(filters?: TransactionFilters, limit = 50, offset = 0): Promise<Transaction[]> {
    let query = `
      SELECT t.*,
             c.name as categoryName,
             c.icon as categoryIcon,
             c.color as categoryColor,
             a.name as accountName
      FROM transactions t
      LEFT JOIN categories c ON t.categoryId = c.id
      LEFT JOIN accounts a ON t.accountId = a.id
      WHERE t.deletedAt IS NULL
    `;
    const params: (string | number)[] = [];

    if (filters?.type) {
      query += ' AND t.type = ?';
      params.push(filters.type);
    }
    if (filters?.categoryId) {
      query += ' AND t.categoryId = ?';
      params.push(filters.categoryId);
    }
    if (filters?.accountId) {
      query += ' AND t.accountId = ?';
      params.push(filters.accountId);
    }
    if (filters?.toAccountId) {
      query += ' AND t.toAccountId = ?';
      params.push(filters.toAccountId);
    }
    if (filters?.dateFrom) {
      query += ' AND t.date >= ?';
      params.push(filters.dateFrom);
    }
    if (filters?.dateTo) {
      query += ' AND t.date <= ?';
      params.push(filters.dateTo);
    }
    if (filters?.minAmount !== undefined) {
      query += ' AND t.amount >= ?';
      params.push(filters.minAmount);
    }
    if (filters?.maxAmount !== undefined) {
      query += ' AND t.amount <= ?';
      params.push(filters.maxAmount);
    }
    if (filters?.search) {
      query += ' AND (t.merchant LIKE ? OR t.notes LIKE ? OR t.tags LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY t.date DESC, t.createdAt DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await getDatabase().getAllAsync<Transaction & { tags: string; isRecurring: number }>(query, params);
    return rows.map(parseTransaction);
  },

  async getById(id: string): Promise<Transaction | null> {
    const row = await getDatabase().getFirstAsync<Transaction & { tags: string; isRecurring: number }>(
      `SELECT t.*,
              c.name as categoryName,
              c.icon as categoryIcon,
              c.color as categoryColor,
              a.name as accountName
       FROM transactions t
       LEFT JOIN categories c ON t.categoryId = c.id
       LEFT JOIN accounts a ON t.accountId = a.id
       WHERE t.id = ? AND t.deletedAt IS NULL`,
      [id],
    );

    return row ? parseTransaction(row) : null;
  },

  async create(data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'syncStatus' | 'lastSyncedAt' | 'deletedAt'>): Promise<Transaction> {
    const now = new Date().toISOString();
    const transaction: Transaction = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      userId: null,
      syncStatus: 'pending',
      lastSyncedAt: null,
      deletedAt: null,
    };

    await getDatabase().runAsync(
      `INSERT INTO transactions
        (id, amount, type, categoryId, accountId, toAccountId, merchant, notes, tags, date, paymentMethod, isRecurring, recurringId, createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transaction.id,
        transaction.amount,
        transaction.type,
        transaction.categoryId,
        transaction.accountId,
        bindValue(transaction.toAccountId),
        bindValue(transaction.merchant),
        bindValue(transaction.notes),
        JSON.stringify(transaction.tags ?? []),
        transaction.date,
        transaction.paymentMethod,
        transaction.isRecurring ? 1 : 0,
        bindValue(transaction.recurringId),
        transaction.createdAt,
        transaction.updatedAt,
        bindValue(transaction.userId),
        transaction.syncStatus,
        bindValue(transaction.lastSyncedAt),
        bindValue(transaction.deletedAt),
      ],
    );

    await applyBalanceEffect(transaction.type, transaction.amount, transaction.accountId, transaction.toAccountId);
    await enqueueSync('transactions', transaction.id, 'upsert', {
      ...transaction,
      tags: JSON.stringify(transaction.tags ?? []),
      isRecurring: transaction.isRecurring ? 1 : 0,
    });
    void triggerBackgroundSync('transaction-created');

    const created = await this.getById(transaction.id);
    if (!created) {
      throw new Error('Failed to read created transaction');
    }
    return created;
  },

  async update(id: string, data: Partial<Transaction>): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('Transaction not found');
    }

    await applyBalanceEffect(existing.type, existing.amount, existing.accountId, existing.toAccountId, true);

    const updatedAt = new Date().toISOString();
    const updated: Transaction = {
      ...existing,
      ...data,
      updatedAt,
      syncStatus: 'pending',
    };

    await getDatabase().runAsync(
      `UPDATE transactions
       SET amount = ?, type = ?, categoryId = ?, accountId = ?, toAccountId = ?, merchant = ?, notes = ?, tags = ?, date = ?, paymentMethod = ?, isRecurring = ?, recurringId = ?, updatedAt = ?, syncStatus = 'pending'
       WHERE id = ?`,
      [
        updated.amount,
        updated.type,
        updated.categoryId,
        updated.accountId,
        bindValue(updated.toAccountId),
        bindValue(updated.merchant),
        bindValue(updated.notes),
        JSON.stringify(updated.tags ?? []),
        updated.date,
        updated.paymentMethod,
        updated.isRecurring ? 1 : 0,
        bindValue(updated.recurringId),
        updated.updatedAt,
        id,
      ],
    );

    await applyBalanceEffect(updated.type, updated.amount, updated.accountId, updated.toAccountId);
    await enqueueSync('transactions', id, 'upsert', {
      ...updated,
      tags: JSON.stringify(updated.tags ?? []),
      isRecurring: updated.isRecurring ? 1 : 0,
    });
    void triggerBackgroundSync('transaction-updated');
  },

  async delete(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      return;
    }

    const deletedAt = new Date().toISOString();
    await applyBalanceEffect(existing.type, existing.amount, existing.accountId, existing.toAccountId, true);
    await getDatabase().runAsync(
      `UPDATE transactions
       SET deletedAt = ?, updatedAt = ?, syncStatus = 'pending'
       WHERE id = ?`,
      [deletedAt, deletedAt, id],
    );
    await enqueueSync('transactions', id, 'delete', { id, deletedAt, updatedAt: deletedAt });
  },

  async getMonthlyStats(year: number, month: string): Promise<{ income: number; expense: number }> {
    const rows = await getDatabase().getAllAsync<{ type: string; total: number }>(
      `SELECT type, COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE deletedAt IS NULL AND strftime('%Y', date) = ? AND strftime('%m', date) = ? AND type != 'transfer'
       GROUP BY type`,
      [year.toString(), month],
    );

    return rows.reduce(
      (accumulator, row) => {
        if (row.type === 'income') {
          accumulator.income = row.total;
        }
        if (row.type === 'expense') {
          accumulator.expense = row.total;
        }
        return accumulator;
      },
      { income: 0, expense: 0 },
    );
  },

  async getCategoryBreakdown(year: number, month: string, type: TransactionType = 'expense') {
    return getDatabase().getAllAsync<{
      categoryId: string;
      categoryName: string;
      categoryColor: string;
      total: number;
    }>(
      `SELECT t.categoryId, c.name as categoryName, c.color as categoryColor, COALESCE(SUM(t.amount), 0) as total
       FROM transactions t
       LEFT JOIN categories c ON t.categoryId = c.id
       WHERE t.deletedAt IS NULL AND strftime('%Y', t.date) = ? AND strftime('%m', t.date) = ? AND t.type = ?
       GROUP BY t.categoryId
       ORDER BY total DESC`,
      [year.toString(), month, type],
    );
  },

  async getMonthlyTrend(months = 6) {
    return getDatabase().getAllAsync<{ month: string; income: number; expense: number }>(
      `SELECT strftime('%Y-%m', date) as month,
              COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
              COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
       FROM transactions
       WHERE deletedAt IS NULL AND date >= date('now', ?)
       GROUP BY month
       ORDER BY month ASC`,
      [`-${months} months`],
    );
  },

  async exportToCSV(): Promise<string> {
    const transactions = await this.getAll(undefined, 100000, 0);
    const header = 'Date,Type,Amount,Category,Account,Payment Method,Merchant,Notes,Tags';
    const rows = transactions.map((transaction) =>
      [
        transaction.date,
        transaction.type,
        transaction.amount,
        transaction.categoryName ?? '',
        transaction.accountName ?? '',
        transaction.paymentMethod,
        transaction.merchant ?? '',
        transaction.notes ?? '',
        transaction.tags.join(';'),
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(','),
    );

    return [header, ...rows].join('\n');
  },
};
