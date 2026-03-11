import { getDatabase } from '../database';
import { Transaction, TransactionFilters, TransactionType } from '../utils/types';
import { generateId } from '../utils/constants';

export const TransactionService = {
  async getAll(filters?: TransactionFilters, limit = 50, offset = 0): Promise<Transaction[]> {
    const db = getDatabase();
    let query = `
      SELECT t.*,
             c.name as categoryName, c.icon as categoryIcon, c.color as categoryColor,
             a.name as accountName
      FROM transactions t
      LEFT JOIN categories c ON t.categoryId = c.id
      LEFT JOIN accounts a ON t.accountId = a.id
      WHERE 1=1
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
    if (filters?.dateFrom) {
      query += ' AND t.date >= ?';
      params.push(filters.dateFrom);
    }
    if (filters?.dateTo) {
      query += ' AND t.date <= ?';
      params.push(filters.dateTo);
    }
    if (filters?.minAmount) {
      query += ' AND t.amount >= ?';
      params.push(filters.minAmount);
    }
    if (filters?.maxAmount) {
      query += ' AND t.amount <= ?';
      params.push(filters.maxAmount);
    }
    if (filters?.search) {
      query += ' AND (t.merchant LIKE ? OR t.notes LIKE ? OR t.tags LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s);
    }

    query += ' ORDER BY t.date DESC, t.createdAt DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await db.getAllAsync<any>(query, params);
    return rows.map(parseTransaction);
  },

  async getById(id: string): Promise<Transaction | null> {
    const db = getDatabase();
    const row = await db.getFirstAsync<any>(`
      SELECT t.*, c.name as categoryName, c.icon as categoryIcon, c.color as categoryColor, a.name as accountName
      FROM transactions t
      LEFT JOIN categories c ON t.categoryId = c.id
      LEFT JOIN accounts a ON t.accountId = a.id
      WHERE t.id = ?
    `, [id]);
    return row ? parseTransaction(row) : null;
  },

  async create(data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<Transaction> {
    const db = getDatabase();
    const id = generateId();
    const now = new Date().toISOString();
    const tags = JSON.stringify(data.tags || []);

    await db.runAsync(
      `INSERT INTO transactions (id, amount, type, categoryId, accountId, toAccountId, merchant, notes, tags, date, isRecurring, recurringId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.amount, data.type, data.categoryId, data.accountId, data.toAccountId || null,
       data.merchant || null, data.notes || null, tags, data.date, data.isRecurring ? 1 : 0,
       data.recurringId || null, now, now]
    );

    // Update account balance
    if (data.type === 'income') {
      await db.runAsync('UPDATE accounts SET balance = balance + ?, updatedAt = ? WHERE id = ?', [data.amount, now, data.accountId]);
    } else if (data.type === 'expense') {
      await db.runAsync('UPDATE accounts SET balance = balance - ?, updatedAt = ? WHERE id = ?', [data.amount, now, data.accountId]);
    } else if (data.type === 'transfer' && data.toAccountId) {
      await db.runAsync('UPDATE accounts SET balance = balance - ?, updatedAt = ? WHERE id = ?', [data.amount, now, data.accountId]);
      await db.runAsync('UPDATE accounts SET balance = balance + ?, updatedAt = ? WHERE id = ?', [data.amount, now, data.toAccountId]);
    }

    // Update budget spent
    if (data.type === 'expense') {
      const month = data.date.slice(5, 7);
      const year = parseInt(data.date.slice(0, 4));
      await db.runAsync(
        'UPDATE budgets SET spent = spent + ? WHERE categoryId = ? AND month = ? AND year = ?',
        [data.amount, data.categoryId, month, year]
      );
    }

    return (await this.getById(id))!;
  },

  async update(id: string, data: Partial<Transaction>): Promise<void> {
    const db = getDatabase();
    const now = new Date().toISOString();
    const existing = await this.getById(id);
    if (!existing) throw new Error('Transaction not found');

    // Reverse old balance effect
    if (existing.type === 'income') {
      await db.runAsync('UPDATE accounts SET balance = balance - ? WHERE id = ?', [existing.amount, existing.accountId]);
    } else if (existing.type === 'expense') {
      await db.runAsync('UPDATE accounts SET balance = balance + ? WHERE id = ?', [existing.amount, existing.accountId]);
    }

    const updated = { ...existing, ...data };
    await db.runAsync(
      `UPDATE transactions SET amount=?, type=?, categoryId=?, accountId=?, merchant=?, notes=?, tags=?, date=?, updatedAt=? WHERE id=?`,
      [updated.amount, updated.type, updated.categoryId, updated.accountId,
       updated.merchant || null, updated.notes || null, JSON.stringify(updated.tags),
       updated.date, now, id]
    );

    // Apply new balance effect
    if (updated.type === 'income') {
      await db.runAsync('UPDATE accounts SET balance = balance + ? WHERE id = ?', [updated.amount, updated.accountId]);
    } else if (updated.type === 'expense') {
      await db.runAsync('UPDATE accounts SET balance = balance - ? WHERE id = ?', [updated.amount, updated.accountId]);
    }
  },

  async delete(id: string): Promise<void> {
    const db = getDatabase();
    const existing = await this.getById(id);
    if (!existing) return;

    const now = new Date().toISOString();
    if (existing.type === 'income') {
      await db.runAsync('UPDATE accounts SET balance = balance - ?, updatedAt = ? WHERE id = ?', [existing.amount, now, existing.accountId]);
    } else if (existing.type === 'expense') {
      await db.runAsync('UPDATE accounts SET balance = balance + ?, updatedAt = ? WHERE id = ?', [existing.amount, now, existing.accountId]);
    }

    await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
  },

  async getMonthlyStats(year: number, month: string): Promise<{ income: number; expense: number }> {
    const db = getDatabase();
    const rows = await db.getAllAsync<{ type: string; total: number }>(
      `SELECT type, SUM(amount) as total FROM transactions
       WHERE strftime('%Y', date) = ? AND strftime('%m', date) = ?
       AND type != 'transfer'
       GROUP BY type`,
      [year.toString(), month]
    );
    const stats = { income: 0, expense: 0 };
    for (const row of rows) {
      if (row.type === 'income') stats.income = row.total;
      else if (row.type === 'expense') stats.expense = row.total;
    }
    return stats;
  },

  async getCategoryBreakdown(year: number, month: string, type: TransactionType = 'expense') {
    const db = getDatabase();
    return db.getAllAsync<{ categoryId: string; categoryName: string; categoryColor: string; total: number }>(
      `SELECT t.categoryId, c.name as categoryName, c.color as categoryColor, SUM(t.amount) as total
       FROM transactions t
       LEFT JOIN categories c ON t.categoryId = c.id
       WHERE strftime('%Y', t.date) = ? AND strftime('%m', t.date) = ? AND t.type = ?
       GROUP BY t.categoryId
       ORDER BY total DESC`,
      [year.toString(), month, type]
    );
  },

  async getMonthlyTrend(months = 6) {
    const db = getDatabase();
    return db.getAllAsync<{ month: string; income: number; expense: number }>(
      `SELECT strftime('%Y-%m', date) as month,
              SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
              SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense
       FROM transactions
       WHERE date >= date('now', '-${months} months')
       GROUP BY month
       ORDER BY month ASC`
    );
  },

  async exportToCSV(): Promise<string> {
    const transactions = await this.getAll(undefined, 100000, 0);
    const headers = 'Date,Type,Amount,Category,Account,Merchant,Notes,Tags\n';
    const rows = transactions.map(t =>
      `${t.date},${t.type},${t.amount},${t.categoryName || ''},${t.accountName || ''},${t.merchant || ''},${t.notes || ''},${t.tags.join(';')}`
    ).join('\n');
    return headers + rows;
  },
};

function parseTransaction(row: any): Transaction {
  return {
    ...row,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
    isRecurring: row.isRecurring === 1,
  };
}
