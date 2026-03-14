-- Migration: Add Split Expenses Feature
-- Created: 2026-03-14

-- UP
CREATE TABLE IF NOT EXISTS split_expenses (
  id TEXT PRIMARY KEY,
  transaction_id TEXT REFERENCES transactions(id) ON DELETE CASCADE,
  paid_by_user_id TEXT NOT NULL,
  total_amount REAL NOT NULL,
  split_method TEXT NOT NULL CHECK (split_method IN ('equal', 'exact', 'percent')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS split_members (
  id TEXT PRIMARY KEY,
  split_expense_id TEXT NOT NULL REFERENCES split_expenses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  share_amount REAL NOT NULL,
  share_percent REAL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','declined')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_split_expenses_transaction ON split_expenses(transaction_id);
CREATE INDEX IF NOT EXISTS idx_split_members_expense ON split_members(split_expense_id);

-- DOWN
DROP INDEX IF EXISTS idx_split_members_expense;
DROP INDEX IF EXISTS idx_split_expenses_transaction;
DROP TABLE IF EXISTS split_members;
DROP TABLE IF EXISTS split_expenses;
