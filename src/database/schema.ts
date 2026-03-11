import { builtInCategories } from '@/modules/data/defaultCategories';
import { executeSql } from './sqliteClient';

export const initDatabase = async () => {
  await executeSql(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'INR',
      updatedAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    );
  `);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      categoryId TEXT,
      accountId TEXT,
      merchant TEXT,
      notes TEXT,
      tags TEXT,
      date INTEGER NOT NULL,
      isRecurring INTEGER DEFAULT 0,
      recurrence TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      categoryId TEXT NOT NULL,
      limitAmount REAL NOT NULL,
      month TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      targetAmount REAL NOT NULL,
      currentAmount REAL NOT NULL,
      deadline INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      value REAL NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS liabilities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      recordId TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT,
      createdAt INTEGER NOT NULL
    );
  `);

  for (const category of builtInCategories) {
    await executeSql(
      'INSERT OR IGNORE INTO categories (id, name, type, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?);',
      [category.id, category.name, category.type, Date.now(), Date.now()],
    );
  }
};
