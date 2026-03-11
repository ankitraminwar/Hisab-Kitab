import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase;

export const getDatabase = () => {
  if (!db) {
    db = SQLite.openDatabaseSync('hisabkitab.db');
  }
  return db;
};

export const initializeDatabase = async (): Promise<void> => {
  const database = getDatabase();

  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('cash','bank','upi','credit_card','wallet','investment')),
      balance REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'INR',
      color TEXT DEFAULT '#7C3AED',
      icon TEXT DEFAULT 'wallet',
      isDefault INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('expense','income','both')),
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      isCustom INTEGER DEFAULT 0,
      parentId TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
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
      isRecurring INTEGER DEFAULT 0,
      recurringId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (categoryId) REFERENCES categories(id),
      FOREIGN KEY (accountId) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      categoryId TEXT NOT NULL,
      limit_amount REAL NOT NULL,
      spent REAL NOT NULL DEFAULT 0,
      month TEXT NOT NULL,
      year INTEGER NOT NULL,
      alertAt INTEGER DEFAULT 80,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (categoryId) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS goals (
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
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('bank','cash','stocks','mutual_funds','crypto','gold','real_estate','other')),
      value REAL NOT NULL,
      notes TEXT,
      lastUpdated TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS liabilities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('credit_card','loan','mortgage','other')),
      amount REAL NOT NULL,
      interestRate REAL DEFAULT 0,
      dueDate TEXT,
      notes TEXT,
      lastUpdated TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recurring_templates (
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
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS net_worth_history (
      id TEXT PRIMARY KEY,
      totalAssets REAL NOT NULL,
      totalLiabilities REAL NOT NULL,
      netWorth REAL NOT NULL,
      date TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_categoryId ON transactions(categoryId);
    CREATE INDEX IF NOT EXISTS idx_transactions_accountId ON transactions(accountId);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_budgets_month_year ON budgets(month, year);
  `);

  await seedDefaultData(database);
};

const seedDefaultData = async (database: SQLite.SQLiteDatabase) => {
  const existing = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );
  if (existing && existing.count > 0) return;

  const now = new Date().toISOString();

  const categories = [
    { id: 'cat_food', name: 'Food & Dining', type: 'expense', icon: 'restaurant', color: '#F97316' },
    { id: 'cat_groceries', name: 'Groceries', type: 'expense', icon: 'cart', color: '#22C55E' },
    { id: 'cat_transport', name: 'Transport', type: 'expense', icon: 'car', color: '#3B82F6' },
    { id: 'cat_shopping', name: 'Shopping', type: 'expense', icon: 'bag', color: '#EC4899' },
    { id: 'cat_travel', name: 'Travel', type: 'expense', icon: 'airplane', color: '#14B8A6' },
    { id: 'cat_rent', name: 'Rent', type: 'expense', icon: 'home', color: '#8B5CF6' },
    { id: 'cat_utilities', name: 'Utilities', type: 'expense', icon: 'flash', color: '#EAB308' },
    { id: 'cat_entertainment', name: 'Entertainment', type: 'expense', icon: 'film', color: '#F43F5E' },
    { id: 'cat_health', name: 'Health', type: 'expense', icon: 'medkit', color: '#06B6D4' },
    { id: 'cat_education', name: 'Education', type: 'expense', icon: 'school', color: '#84CC16' },
    { id: 'cat_investment', name: 'Investment', type: 'expense', icon: 'trending-up', color: '#10B981' },
    { id: 'cat_salary', name: 'Salary', type: 'income', icon: 'briefcase', color: '#22C55E' },
    { id: 'cat_freelance', name: 'Freelance', type: 'income', icon: 'laptop', color: '#3B82F6' },
    { id: 'cat_business', name: 'Business', type: 'income', icon: 'business', color: '#F97316' },
    { id: 'cat_interest', name: 'Interest', type: 'income', icon: 'cash', color: '#8B5CF6' },
    { id: 'cat_other_income', name: 'Other Income', type: 'income', icon: 'add-circle', color: '#14B8A6' },
    { id: 'cat_other', name: 'Other', type: 'both', icon: 'ellipsis-horizontal', color: '#6B7280' },
  ];

  for (const cat of categories) {
    await database.runAsync(
      'INSERT OR IGNORE INTO categories (id, name, type, icon, color, isCustom, createdAt) VALUES (?, ?, ?, ?, ?, 0, ?)',
      [cat.id, cat.name, cat.type, cat.icon, cat.color, now]
    );
  }

  // Default cash account
  const accountId = 'acc_default_cash';
  await database.runAsync(
    'INSERT OR IGNORE INTO accounts (id, name, type, balance, currency, color, icon, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [accountId, 'Cash Wallet', 'cash', 0, 'INR', '#22C55E', 'cash', 1, now, now]
  );
};
