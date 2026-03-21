import type { SQLiteBindValue } from 'expo-sqlite';
import { enqueueSync, getDatabase } from '../database';
import { triggerBackgroundSync } from '../services/syncService';
import { useAppStore } from '../store/appStore';
import { generateId } from '../utils/constants';
import type { SplitExpense, SplitMember, SplitStatus } from '../utils/types';

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

type SplitExpenseRow = SplitExpense & {
  transaction_id?: string;
  paid_by_user_id?: string;
  total_amount?: number | string;
  split_method?: SplitExpense['splitMethod'];
};

type SplitMemberRow = SplitMember & {
  split_expense_id?: string;
  share_amount?: number | string;
  share_percent?: number | string | null;
};

const parseSplitExpense = (row: SplitExpenseRow): SplitExpense => ({
  ...row,
  transactionId: row.transactionId ?? row.transaction_id ?? '',
  paidByUserId: row.paidByUserId ?? row.paid_by_user_id ?? '',
  totalAmount: Number(row.totalAmount ?? row.total_amount) || 0,
  splitMethod: row.splitMethod ?? row.split_method ?? 'equal',
});

const parseSplitMember = (row: SplitMemberRow): SplitMember => ({
  ...row,
  splitExpenseId: row.splitExpenseId ?? row.split_expense_id ?? '',
  shareAmount: Number(row.shareAmount ?? row.share_amount) || 0,
  sharePercent:
    row.sharePercent != null || row.share_percent != null
      ? Number(row.sharePercent ?? row.share_percent) || 0
      : undefined,
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

export const SplitService = {
  async createSplit(
    expenseData: Omit<
      SplitExpense,
      'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'lastSyncedAt' | 'deletedAt'
    >,
    membersData: Omit<
      SplitMember,
      | 'id'
      | 'splitExpenseId'
      | 'createdAt'
      | 'updatedAt'
      | 'syncStatus'
      | 'lastSyncedAt'
      | 'deletedAt'
    >[],
  ) {
    const now = new Date().toISOString();
    const expenseId = generateId();
    const db = getDatabase();

    const expense: SplitExpense = {
      ...expenseData,
      id: expenseId,
      createdAt: now,
      updatedAt: now,
      ...createSyncMetadata(),
    };

    const members: SplitMember[] = [];

    await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
    try {
      // 1. Insert SplitExpense
      await db.runAsync(
        `INSERT INTO split_expenses
          (id, transaction_id, paid_by_user_id, total_amount, split_method, notes, createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          expense.id,
          expense.transactionId,
          expense.paidByUserId,
          expense.totalAmount,
          expense.splitMethod,
          bindValue(expense.notes),
          expense.createdAt,
          expense.updatedAt,
          bindValue(expense.userId),
          expense.syncStatus,
          bindValue(expense.lastSyncedAt),
          bindValue(expense.deletedAt),
        ],
      );

      // 2. Insert SplitMembers
      for (const mData of membersData) {
        const member: SplitMember = {
          ...mData,
          id: generateId(),
          splitExpenseId: expenseId,
          createdAt: now,
          updatedAt: now,
          ...createSyncMetadata(),
        };

        await db.runAsync(
          `INSERT INTO split_members
            (id, split_expense_id, name, share_amount, share_percent, status, createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            member.id,
            member.splitExpenseId,
            member.name,
            member.shareAmount,
            bindValue(member.sharePercent),
            member.status,
            member.createdAt,
            member.updatedAt,
            bindValue(member.userId),
            member.syncStatus,
            bindValue(member.lastSyncedAt),
            bindValue(member.deletedAt),
          ],
        );

        members.push(member);
      }

      await db.execAsync('COMMIT');
    } catch (e) {
      await db.execAsync('ROLLBACK');
      throw e;
    }

    // Enqueue sync outside the transaction
    await queueEntitySync(
      'split_expenses',
      expense.id,
      expense as unknown as Record<string, unknown>,
    );
    for (const member of members) {
      await queueEntitySync(
        'split_members',
        member.id,
        member as unknown as Record<string, unknown>,
      );
    }

    return { expense, members };
  },

  async getSplitsForTransaction(
    transactionId: string,
  ): Promise<{ expense: SplitExpense; members: SplitMember[] } | null> {
    const expenseRow = await getDatabase().getFirstAsync<SplitExpenseRow>(
      'SELECT * FROM split_expenses WHERE transaction_id = ? AND deletedAt IS NULL',
      [transactionId],
    );

    if (!expenseRow) return null;

    const expense = parseSplitExpense(expenseRow);

    const memberRows = await getDatabase().getAllAsync<SplitMemberRow>(
      'SELECT * FROM split_members WHERE split_expense_id = ? AND deletedAt IS NULL',
      [expense.id],
    );
    const members = memberRows.map(parseSplitMember);

    return { expense, members };
  },

  async markSharePaid(memberId: string, status: SplitStatus) {
    const existingRow = await getDatabase().getFirstAsync<SplitMemberRow>(
      'SELECT * FROM split_members WHERE id = ?',
      [memberId],
    );
    if (!existingRow) throw new Error('Split member not found');

    const existing = parseSplitMember(existingRow);

    const updatedAt = new Date().toISOString();

    await getDatabase().runAsync(
      `UPDATE split_members SET status = ?, updatedAt = ?, syncStatus = 'pending' WHERE id = ?`,
      [status, updatedAt, memberId],
    );

    const updatedMember = {
      ...existing,
      status,
      updatedAt,
      syncStatus: 'pending' as const,
    };
    await queueEntitySync(
      'split_members',
      memberId,
      updatedMember as unknown as Record<string, unknown>,
    );
  },

  /** Get all split expenses with their members and optional transaction info */
  async getAll(): Promise<
    {
      expense: SplitExpense;
      members: SplitMember[];
      transactionMerchant?: string;
      transactionDate?: string;
    }[]
  > {
    const expenses = await getDatabase().getAllAsync<SplitExpense>(
      'SELECT * FROM split_expenses WHERE deletedAt IS NULL ORDER BY createdAt DESC',
    );

    const results: {
      expense: SplitExpense;
      members: SplitMember[];
      transactionMerchant?: string;
      transactionDate?: string;
    }[] = [];

    for (const expenseRow of expenses) {
      const expense = parseSplitExpense(expenseRow);

      const memberRows = await getDatabase().getAllAsync<SplitMemberRow>(
        'SELECT * FROM split_members WHERE split_expense_id = ? AND deletedAt IS NULL',
        [expense.id],
      );
      const members = memberRows.map(parseSplitMember);

      const tx = await getDatabase().getFirstAsync<{
        merchant: string | null;
        notes: string | null;
        date: string;
      }>('SELECT merchant, notes, date FROM transactions WHERE id = ?', [expense.transactionId]);

      results.push({
        expense,
        members,
        transactionMerchant: tx?.merchant || tx?.notes || undefined,
        transactionDate: tx?.date,
      });
    }

    return results;
  },

  /** Get a single split expense by ID with members */
  async getById(splitId: string): Promise<{
    expense: SplitExpense;
    members: SplitMember[];
    transactionMerchant?: string;
    transactionDate?: string;
  } | null> {
    const expenseRow = await getDatabase().getFirstAsync<SplitExpenseRow>(
      'SELECT * FROM split_expenses WHERE id = ? AND deletedAt IS NULL',
      [splitId],
    );
    if (!expenseRow) return null;

    const expense = parseSplitExpense(expenseRow);

    const memberRows = await getDatabase().getAllAsync<SplitMemberRow>(
      'SELECT * FROM split_members WHERE split_expense_id = ? AND deletedAt IS NULL',
      [expense.id],
    );
    const members = memberRows.map(parseSplitMember);

    const tx = await getDatabase().getFirstAsync<{
      merchant: string | null;
      notes: string | null;
      date: string;
    }>('SELECT merchant, notes, date FROM transactions WHERE id = ?', [expense.transactionId]);

    return {
      expense,
      members,
      transactionMerchant: tx?.merchant || tx?.notes || undefined,
      transactionDate: tx?.date,
    };
  },

  /** Record a payment from a split member */
  async recordPayment(memberId: string, amountPaid: number) {
    const memberRow = await getDatabase().getFirstAsync<SplitMemberRow>(
      'SELECT * FROM split_members WHERE id = ?',
      [memberId],
    );
    if (!memberRow) throw new Error('Member not found');

    const member = parseSplitMember(memberRow);

    const remaining = (Number(member.shareAmount) || 0) - amountPaid;
    const newStatus: SplitStatus = remaining <= 0 ? 'paid' : 'pending';
    const updatedAt = new Date().toISOString();

    await getDatabase().runAsync(
      `UPDATE split_members
       SET status = ?, share_amount = ?, updatedAt = ?, syncStatus = 'pending'
       WHERE id = ?`,
      [newStatus, Math.max(remaining, 0), updatedAt, memberId],
    );

    const updatedMember = {
      ...member,
      status: newStatus,
      shareAmount: Math.max(remaining, 0),
      updatedAt,
      syncStatus: 'pending' as const,
    };
    await queueEntitySync(
      'split_members',
      memberId,
      updatedMember as unknown as Record<string, unknown>,
    );
  },

  /** Soft-delete a split expense and its members */
  async deleteSplit(splitId: string) {
    const now = new Date().toISOString();

    // Soft-delete members first
    const memberRows = await getDatabase().getAllAsync<SplitMemberRow>(
      'SELECT * FROM split_members WHERE split_expense_id = ? AND deletedAt IS NULL',
      [splitId],
    );
    const members = memberRows.map(parseSplitMember);

    for (const member of members) {
      await getDatabase().runAsync(
        `UPDATE split_members SET deletedAt = ?, updatedAt = ?, syncStatus = 'pending' WHERE id = ?`,
        [now, now, member.id],
      );
      await queueEntitySync(
        'split_members',
        member.id,
        {
          ...member,
          deletedAt: now,
          updatedAt: now,
          syncStatus: 'pending',
        } as unknown as Record<string, unknown>,
        'delete',
      );
    }

    // Soft-delete the expense
    await getDatabase().runAsync(
      `UPDATE split_expenses SET deletedAt = ?, updatedAt = ?, syncStatus = 'pending' WHERE id = ?`,
      [now, now, splitId],
    );

    const expenseRow = await getDatabase().getFirstAsync<SplitExpenseRow>(
      'SELECT * FROM split_expenses WHERE id = ?',
      [splitId],
    );
    if (expenseRow) {
      const expense = parseSplitExpense(expenseRow);
      await queueEntitySync(
        'split_expenses',
        splitId,
        {
          ...expense,
          deletedAt: now,
          updatedAt: now,
          syncStatus: 'pending',
        } as unknown as Record<string, unknown>,
        'delete',
      );
    }
  },
};
