import { getDatabase } from '../database';
import { Account, Budget, Goal, Asset, Liability } from '../utils/types';
import { generateId } from '../utils/constants';

// ─── Account Service ─────────────────────────────────────────────────────────
export const AccountService = {
  async getAll(): Promise<Account[]> {
    const db = getDatabase();
    const rows = await db.getAllAsync<any>('SELECT * FROM accounts ORDER BY isDefault DESC, name ASC');
    return rows.map(r => ({ ...r, isDefault: r.isDefault === 1 }));
  },

  async create(data: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Promise<Account> {
    const db = getDatabase();
    const id = generateId();
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO accounts (id,name,type,balance,currency,color,icon,isDefault,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [id, data.name, data.type, data.balance, data.currency, data.color, data.icon, data.isDefault ? 1 : 0, now, now]
    );
    return { ...data, id, createdAt: now, updatedAt: now };
  },

  async update(id: string, data: Partial<Account>): Promise<void> {
    const db = getDatabase();
    const now = new Date().toISOString();
    await db.runAsync(
      'UPDATE accounts SET name=?,type=?,color=?,icon=?,updatedAt=? WHERE id=?',
      [data.name!, data.type!, data.color!, data.icon!, now, id]
    );
  },

  async delete(id: string): Promise<void> {
    const db = getDatabase();
    await db.runAsync('DELETE FROM accounts WHERE id=?', [id]);
  },

  async getTotalBalance(): Promise<number> {
    const db = getDatabase();
    const row = await db.getFirstAsync<{ total: number }>('SELECT SUM(balance) as total FROM accounts');
    return row?.total || 0;
  },
};

// ─── Category Service ─────────────────────────────────────────────────────────
export const CategoryService = {
  async getAll() {
    const db = getDatabase();
    return db.getAllAsync<any>('SELECT * FROM categories ORDER BY isCustom ASC, name ASC');
  },

  async create(data: { name: string; type: string; icon: string; color: string }) {
    const db = getDatabase();
    const id = generateId();
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO categories (id,name,type,icon,color,isCustom,createdAt) VALUES (?,?,?,?,?,1,?)',
      [id, data.name, data.type, data.icon, data.color, now]
    );
    return id;
  },
};

// ─── Budget Service ─────────────────────────────────────────────────────────
export const BudgetService = {
  async getForMonth(year: number, month: string): Promise<Budget[]> {
    const db = getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT b.*, c.name as categoryName, c.icon as categoryIcon, c.color as categoryColor
       FROM budgets b LEFT JOIN categories c ON b.categoryId = c.id
       WHERE b.year = ? AND b.month = ?`,
      [year, month]
    );
    return rows;
  },

  async create(data: Omit<Budget, 'id' | 'spent' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const db = getDatabase();
    const id = generateId();
    const now = new Date().toISOString();

    // Calculate already-spent amount for this month
    const spent = await db.getFirstAsync<{ total: number }>(
      `SELECT SUM(amount) as total FROM transactions
       WHERE categoryId=? AND strftime('%m',date)=? AND strftime('%Y',date)=? AND type='expense'`,
      [data.categoryId, data.month, data.year.toString()]
    );

    await db.runAsync(
      'INSERT INTO budgets (id,categoryId,limit_amount,spent,month,year,alertAt,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, data.categoryId, data.limit_amount, spent?.total || 0, data.month, data.year, data.alertAt, now, now]
    );
    return id;
  },

  async update(id: string, limit_amount: number): Promise<void> {
    const db = getDatabase();
    await db.runAsync('UPDATE budgets SET limit_amount=?,updatedAt=? WHERE id=?', [limit_amount, new Date().toISOString(), id]);
  },

  async delete(id: string): Promise<void> {
    const db = getDatabase();
    await db.runAsync('DELETE FROM budgets WHERE id=?', [id]);
  },
};

// ─── Goals Service ─────────────────────────────────────────────────────────
export const GoalService = {
  async getAll(): Promise<Goal[]> {
    const db = getDatabase();
    const rows = await db.getAllAsync<any>('SELECT * FROM goals ORDER BY isCompleted ASC, createdAt DESC');
    return rows.map(r => ({ ...r, isCompleted: r.isCompleted === 1 }));
  },

  async create(data: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const db = getDatabase();
    const id = generateId();
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO goals (id,name,targetAmount,currentAmount,deadline,icon,color,accountId,isCompleted,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,0,?,?)',
      [id, data.name, data.targetAmount, data.currentAmount, data.deadline || null, data.icon, data.color, data.accountId || null, now, now]
    );
    return id;
  },

  async addFunds(id: string, amount: number): Promise<void> {
    const db = getDatabase();
    const now = new Date().toISOString();
    await db.runAsync(
      'UPDATE goals SET currentAmount = MIN(currentAmount + ?, targetAmount), isCompleted = CASE WHEN currentAmount + ? >= targetAmount THEN 1 ELSE 0 END, updatedAt=? WHERE id=?',
      [amount, amount, now, id]
    );
  },

  async delete(id: string): Promise<void> {
    const db = getDatabase();
    await db.runAsync('DELETE FROM goals WHERE id=?', [id]);
  },
};

// ─── Assets/Liabilities Service ─────────────────────────────────────────────
export const NetWorthService = {
  async getAssets(): Promise<Asset[]> {
    return getDatabase().getAllAsync<Asset>('SELECT * FROM assets ORDER BY value DESC');
  },

  async getLiabilities(): Promise<Liability[]> {
    return getDatabase().getAllAsync<Liability>('SELECT * FROM liabilities ORDER BY amount DESC');
  },

  async createAsset(data: Omit<Asset, 'id' | 'createdAt'>): Promise<string> {
    const db = getDatabase();
    const id = generateId();
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO assets (id,name,type,value,notes,lastUpdated,createdAt) VALUES (?,?,?,?,?,?,?)',
      [id, data.name, data.type, data.value, data.notes || null, now, now]
    );
    return id;
  },

  async createLiability(data: Omit<Liability, 'id' | 'createdAt'>): Promise<string> {
    const db = getDatabase();
    const id = generateId();
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO liabilities (id,name,type,amount,interestRate,dueDate,notes,lastUpdated,createdAt) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, data.name, data.type, data.amount, data.interestRate, data.dueDate || null, data.notes || null, now, now]
    );
    return id;
  },

  async updateAsset(id: string, value: number): Promise<void> {
    const now = new Date().toISOString();
    await getDatabase().runAsync('UPDATE assets SET value=?,lastUpdated=? WHERE id=?', [value, now, id]);
  },

  async updateLiability(id: string, amount: number): Promise<void> {
    const now = new Date().toISOString();
    await getDatabase().runAsync('UPDATE liabilities SET amount=?,lastUpdated=? WHERE id=?', [amount, now, id]);
  },

  async deleteAsset(id: string) {
    await getDatabase().runAsync('DELETE FROM assets WHERE id=?', [id]);
  },

  async deleteLiability(id: string) {
    await getDatabase().runAsync('DELETE FROM liabilities WHERE id=?', [id]);
  },

  async getNetWorth(): Promise<{ assets: number; liabilities: number; netWorth: number }> {
    const db = getDatabase();
    const assets = await db.getFirstAsync<{ total: number }>('SELECT SUM(value) as total FROM assets');
    const liabilities = await db.getFirstAsync<{ total: number }>('SELECT SUM(amount) as total FROM liabilities');
    const a = assets?.total || 0;
    const l = liabilities?.total || 0;
    return { assets: a, liabilities: l, netWorth: a - l };
  },

  async saveNetWorthSnapshot(): Promise<void> {
    const { assets, liabilities, netWorth } = await this.getNetWorth();
    const id = generateId();
    await getDatabase().runAsync(
      'INSERT INTO net_worth_history (id,totalAssets,totalLiabilities,netWorth,date) VALUES (?,?,?,?,?)',
      [id, assets, liabilities, netWorth, new Date().toISOString().slice(0, 10)]
    );
  },

  async getNetWorthHistory(months = 12) {
    return getDatabase().getAllAsync<NetWorthHistory>(
      'SELECT * FROM net_worth_history WHERE date >= date("now", ? ) ORDER BY date ASC',
      [`-${months} months`]
    );
  },
};

interface NetWorthHistory {
  id: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  date: string;
}
