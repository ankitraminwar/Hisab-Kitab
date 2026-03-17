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

const queueEntitySync = async (
  table: string,
  id: string,
  payload: Record<string, unknown>,
  operation: 'upsert' | 'delete' = 'upsert',
) => {
  await enqueueSync(table, id, operation, payload);
  useAppStore.getState().bumpDataRevision();
  void triggerBackgroundSync(`${table}-${operation}`);
};

export const SplitService = {
  async createSplit(
    expenseData: Omit<
      SplitExpense,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'syncStatus'
      | 'lastSyncedAt'
      | 'deletedAt'
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

    const expense: SplitExpense = {
      ...expenseData,
      id: expenseId,
      createdAt: now,
      updatedAt: now,
      ...createSyncMetadata(),
    };

    // 1. Insert SplitExpense
    await getDatabase().runAsync(
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

    await queueEntitySync(
      'split_expenses',
      expense.id,
      expense as unknown as Record<string, unknown>,
    );

    // 2. Insert SplitMembers
    const members: SplitMember[] = [];
    for (const mData of membersData) {
      const member: SplitMember = {
        ...mData,
        id: generateId(),
        splitExpenseId: expenseId,
        createdAt: now,
        updatedAt: now,
        ...createSyncMetadata(),
      };

      await getDatabase().runAsync(
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

      await queueEntitySync(
        'split_members',
        member.id,
        member as unknown as Record<string, unknown>,
      );
      members.push(member);
    }

    return { expense, members };
  },

  async getSplitsForTransaction(
    transactionId: string,
  ): Promise<{ expense: SplitExpense; members: SplitMember[] } | null> {
    const expense = await getDatabase().getFirstAsync<SplitExpense>(
      'SELECT * FROM split_expenses WHERE transaction_id = ? AND deletedAt IS NULL',
      [transactionId],
    );

    if (!expense) return null;

    const members = await getDatabase().getAllAsync<SplitMember>(
      'SELECT * FROM split_members WHERE split_expense_id = ? AND deletedAt IS NULL',
      [expense.id],
    );

    return { expense, members };
  },

  async markSharePaid(memberId: string, status: SplitStatus) {
    const existing = await getDatabase().getFirstAsync<SplitMember>(
      'SELECT * FROM split_members WHERE id = ?',
      [memberId],
    );
    if (!existing) throw new Error('Split member not found');

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

    for (const expense of expenses) {
      const members = await getDatabase().getAllAsync<SplitMember>(
        'SELECT * FROM split_members WHERE split_expense_id = ? AND deletedAt IS NULL',
        [expense.id],
      );

      const tx = await getDatabase().getFirstAsync<{
        merchant: string | null;
        notes: string | null;
        date: string;
      }>('SELECT merchant, notes, date FROM transactions WHERE id = ?', [
        expense.transactionId,
      ]);

      results.push({
        expense: {
          ...expense,
          totalAmount: Number(expense.totalAmount) || 0,
        },
        members: members.map((m) => ({
          ...m,
          shareAmount: Number(m.shareAmount) || 0,
          sharePercent:
            m.sharePercent != null ? Number(m.sharePercent) : undefined,
        })),
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
    const expense = await getDatabase().getFirstAsync<SplitExpense>(
      'SELECT * FROM split_expenses WHERE id = ? AND deletedAt IS NULL',
      [splitId],
    );
    if (!expense) return null;

    const members = await getDatabase().getAllAsync<SplitMember>(
      'SELECT * FROM split_members WHERE split_expense_id = ? AND deletedAt IS NULL',
      [expense.id],
    );

    const tx = await getDatabase().getFirstAsync<{
      merchant: string | null;
      notes: string | null;
      date: string;
    }>('SELECT merchant, notes, date FROM transactions WHERE id = ?', [
      expense.transactionId,
    ]);

    return {
      expense: {
        ...expense,
        totalAmount: Number(expense.totalAmount) || 0,
      },
      members: members.map((m) => ({
        ...m,
        shareAmount: Number(m.shareAmount) || 0,
        sharePercent:
          m.sharePercent != null ? Number(m.sharePercent) : undefined,
      })),
      transactionMerchant: tx?.merchant || tx?.notes || undefined,
      transactionDate: tx?.date,
    };
  },

  /** Record a payment from a split member */
  async recordPayment(memberId: string, amountPaid: number) {
    const member = await getDatabase().getFirstAsync<SplitMember>(
      'SELECT * FROM split_members WHERE id = ?',
      [memberId],
    );
    if (!member) throw new Error('Member not found');

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
    const members = await getDatabase().getAllAsync<SplitMember>(
      'SELECT * FROM split_members WHERE split_expense_id = ? AND deletedAt IS NULL',
      [splitId],
    );

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

    const expense = await getDatabase().getFirstAsync<SplitExpense>(
      'SELECT * FROM split_expenses WHERE id = ?',
      [splitId],
    );
    if (expense) {
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
