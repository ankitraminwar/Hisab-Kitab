import type { SQLiteBindValue } from 'expo-sqlite';

import { enqueueSync, getDatabase } from '../database';
import { triggerBackgroundSync } from '../services/syncService';
import { useAppStore } from '../store/appStore';
import { generateId } from '../utils/constants';
import type { SplitExpense, SplitFriend, SplitMember, SplitStatus } from '../utils/types';

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

type SplitExpenseRow = SplitExpense;
type SplitMemberRow = SplitMember;
type SplitFriendRow = SplitFriend;

const parseSplitExpense = (row: SplitExpenseRow): SplitExpense => ({
  ...row,
  totalAmount: Number(row.totalAmount) || 0,
});

const parseSplitMember = (row: SplitMemberRow): SplitMember => ({
  ...row,
  shareAmount: Number(row.shareAmount) || 0,
  sharePercent: row.sharePercent != null ? Number(row.sharePercent) : undefined,
});

const parseSplitFriend = (row: SplitFriendRow): SplitFriend => ({
  ...row,
});

const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

const buildMemberKey = (member: { friendId?: string; name: string }) =>
  member.friendId ? `friend:${member.friendId}` : `name:${normalizeName(member.name)}`;

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
  async getFriends(): Promise<SplitFriend[]> {
    const rows = await getDatabase().getAllAsync<SplitFriendRow>(
      'SELECT * FROM split_friends WHERE deletedAt IS NULL ORDER BY name COLLATE NOCASE ASC',
    );
    return rows.map(parseSplitFriend);
  },

  async saveFriend(name: string, existingId?: string): Promise<SplitFriend> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Friend name is required');
    }

    const now = new Date().toISOString();
    const db = getDatabase();

    const duplicate = await db.getFirstAsync<SplitFriendRow>(
      `SELECT * FROM split_friends
       WHERE deletedAt IS NULL AND lower(trim(name)) = lower(trim(?)) AND (? IS NULL OR id != ?)
       LIMIT 1`,
      [trimmedName, existingId ?? null, existingId ?? null],
    );

    if (duplicate) {
      return parseSplitFriend(duplicate);
    }

    if (existingId) {
      const existing = await db.getFirstAsync<SplitFriendRow>(
        'SELECT * FROM split_friends WHERE id = ?',
        [existingId],
      );
      if (!existing) {
        throw new Error('Friend not found');
      }

      const updated: SplitFriend = {
        ...parseSplitFriend(existing),
        name: trimmedName,
        updatedAt: now,
        syncStatus: 'pending',
        deletedAt: null,
      };

      await db.runAsync(
        `UPDATE split_friends
         SET name = ?, updatedAt = ?, syncStatus = 'pending', deletedAt = NULL
         WHERE id = ?`,
        [updated.name, updated.updatedAt, updated.id],
      );

      await queueEntitySync(
        'split_friends',
        updated.id,
        updated as unknown as Record<string, unknown>,
      );
      return updated;
    }

    const friend: SplitFriend = {
      id: generateId(),
      name: trimmedName,
      createdAt: now,
      updatedAt: now,
      ...createSyncMetadata(),
    };

    await db.runAsync(
      `INSERT INTO split_friends
        (id, name, createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        friend.id,
        friend.name,
        friend.createdAt,
        friend.updatedAt,
        bindValue(friend.userId),
        friend.syncStatus,
        bindValue(friend.lastSyncedAt),
        bindValue(friend.deletedAt),
      ],
    );

    await queueEntitySync('split_friends', friend.id, friend as unknown as Record<string, unknown>);
    return friend;
  },

  async deleteFriend(friendId: string): Promise<void> {
    const existing = await getDatabase().getFirstAsync<SplitFriendRow>(
      'SELECT * FROM split_friends WHERE id = ?',
      [friendId],
    );
    if (!existing) {
      return;
    }

    const deletedAt = new Date().toISOString();
    await getDatabase().runAsync(
      `UPDATE split_friends
       SET deletedAt = ?, updatedAt = ?, syncStatus = 'pending'
       WHERE id = ?`,
      [deletedAt, deletedAt, friendId],
    );

    await queueEntitySync(
      'split_friends',
      friendId,
      {
        ...parseSplitFriend(existing),
        deletedAt,
        updatedAt: deletedAt,
        syncStatus: 'pending',
      } as unknown as Record<string, unknown>,
      'delete',
    );
  },

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
    const existingSplit = await this.getSplitsForTransaction(expenseData.transactionId);
    if (existingSplit) {
      return this.mergeSplit(existingSplit.expense.id, expenseData, membersData);
    }

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
      await db.runAsync(
        `INSERT INTO split_expenses
          (id, transactionId, paidByUserId, totalAmount, splitMethod, notes, createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
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

      for (const memberInput of membersData) {
        const member: SplitMember = {
          ...memberInput,
          id: generateId(),
          splitExpenseId: expenseId,
          createdAt: now,
          updatedAt: now,
          ...createSyncMetadata(),
        };

        await db.runAsync(
          `INSERT INTO split_members
            (id, splitExpenseId, friendId, name, shareAmount, sharePercent, status, createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            member.id,
            member.splitExpenseId,
            bindValue(member.friendId),
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
    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }

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

  async mergeSplit(
    splitId: string,
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
    const db = getDatabase();
    const now = new Date().toISOString();

    const expenseRow = await db.getFirstAsync<SplitExpenseRow>(
      'SELECT * FROM split_expenses WHERE id = ? AND deletedAt IS NULL',
      [splitId],
    );
    if (!expenseRow) {
      throw new Error('Split expense not found');
    }

    const existingExpense = parseSplitExpense(expenseRow);
    const existingMemberRows = await db.getAllAsync<SplitMemberRow>(
      'SELECT * FROM split_members WHERE splitExpenseId = ? AND deletedAt IS NULL',
      [splitId],
    );
    const existingMembers = existingMemberRows.map(parseSplitMember);
    const existingByKey = new Map(
      existingMembers.map((member) => [buildMemberKey(member), member]),
    );

    const expense: SplitExpense = {
      ...existingExpense,
      ...expenseData,
      id: existingExpense.id,
      createdAt: existingExpense.createdAt,
      updatedAt: now,
      syncStatus: 'pending',
      lastSyncedAt: existingExpense.lastSyncedAt,
      deletedAt: null,
    };

    const upsertedMembers: SplitMember[] = [];
    const activeKeys = new Set<string>();
    const deletedMembers: SplitMember[] = [];

    await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
    try {
      await db.runAsync(
        `UPDATE split_expenses
         SET transactionId = ?, paidByUserId = ?, totalAmount = ?, splitMethod = ?, notes = ?, updatedAt = ?, syncStatus = 'pending', deletedAt = NULL
         WHERE id = ?`,
        [
          expense.transactionId,
          expense.paidByUserId,
          expense.totalAmount,
          expense.splitMethod,
          bindValue(expense.notes),
          expense.updatedAt,
          expense.id,
        ],
      );

      for (const memberInput of membersData) {
        const identityKey = buildMemberKey(memberInput);
        activeKeys.add(identityKey);
        const existingMember = existingByKey.get(identityKey);

        if (existingMember) {
          const updatedMember: SplitMember = {
            ...existingMember,
            friendId: memberInput.friendId,
            name: memberInput.name,
            shareAmount: memberInput.shareAmount,
            sharePercent: memberInput.sharePercent,
            status: memberInput.status,
            updatedAt: now,
            syncStatus: 'pending',
            deletedAt: null,
          };

          await db.runAsync(
            `UPDATE split_members
             SET friendId = ?, name = ?, shareAmount = ?, sharePercent = ?, status = ?, updatedAt = ?, syncStatus = 'pending', deletedAt = NULL
             WHERE id = ?`,
            [
              bindValue(updatedMember.friendId),
              updatedMember.name,
              updatedMember.shareAmount,
              bindValue(updatedMember.sharePercent),
              updatedMember.status,
              updatedMember.updatedAt,
              updatedMember.id,
            ],
          );

          upsertedMembers.push(updatedMember);
          continue;
        }

        const createdMember: SplitMember = {
          ...memberInput,
          id: generateId(),
          splitExpenseId: splitId,
          createdAt: now,
          updatedAt: now,
          ...createSyncMetadata(),
        };

        await db.runAsync(
          `INSERT INTO split_members
            (id, splitExpenseId, friendId, name, shareAmount, sharePercent, status, createdAt, updatedAt, userId, syncStatus, lastSyncedAt, deletedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            createdMember.id,
            createdMember.splitExpenseId,
            bindValue(createdMember.friendId),
            createdMember.name,
            createdMember.shareAmount,
            bindValue(createdMember.sharePercent),
            createdMember.status,
            createdMember.createdAt,
            createdMember.updatedAt,
            bindValue(createdMember.userId),
            createdMember.syncStatus,
            bindValue(createdMember.lastSyncedAt),
            bindValue(createdMember.deletedAt),
          ],
        );

        upsertedMembers.push(createdMember);
      }

      for (const member of existingMembers) {
        const memberKey = buildMemberKey(member);
        if (activeKeys.has(memberKey)) {
          continue;
        }

        await db.runAsync(
          `UPDATE split_members
           SET deletedAt = ?, updatedAt = ?, syncStatus = 'pending'
           WHERE id = ?`,
          [now, now, member.id],
        );

        deletedMembers.push({
          ...member,
          deletedAt: now,
          updatedAt: now,
          syncStatus: 'pending',
        });
      }

      await db.execAsync('COMMIT');
    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }

    await queueEntitySync(
      'split_expenses',
      expense.id,
      expense as unknown as Record<string, unknown>,
    );
    for (const member of upsertedMembers) {
      await queueEntitySync(
        'split_members',
        member.id,
        member as unknown as Record<string, unknown>,
      );
    }
    for (const member of deletedMembers) {
      await queueEntitySync(
        'split_members',
        member.id,
        member as unknown as Record<string, unknown>,
        'delete',
      );
    }

    return { expense, members: upsertedMembers };
  },

  async getSplitsForTransaction(
    transactionId: string,
  ): Promise<{ expense: SplitExpense; members: SplitMember[] } | null> {
    const expenseRow = await getDatabase().getFirstAsync<SplitExpenseRow>(
      'SELECT * FROM split_expenses WHERE transactionId = ? AND deletedAt IS NULL',
      [transactionId],
    );

    if (!expenseRow) return null;

    const expense = parseSplitExpense(expenseRow);

    const memberRows = await getDatabase().getAllAsync<SplitMemberRow>(
      'SELECT * FROM split_members WHERE splitExpenseId = ? AND deletedAt IS NULL',
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

    await queueEntitySync('split_members', memberId, {
      ...existing,
      status,
      updatedAt,
      syncStatus: 'pending',
    } as unknown as Record<string, unknown>);
  },

  async getAll(): Promise<
    {
      expense: SplitExpense;
      members: SplitMember[];
      transactionMerchant?: string;
      transactionDate?: string;
    }[]
  > {
    type JoinedRow = SplitExpenseRow &
      SplitMemberRow & {
        t_merchant: string | null;
        t_notes: string | null;
        t_date: string | null;
        m_id: string | null;
        m_name: string | null;
        m_shareAmount: number | null;
        m_sharePercent: number | null;
        m_status: string | null;
        m_friendId: string | null;
        m_splitExpenseId: string | null;
        m_createdAt: string | null;
        m_updatedAt: string | null;
        m_syncStatus: string | null;
        m_lastSyncedAt: string | null;
        m_deletedAt: string | null;
      };

    const rows = await getDatabase().getAllAsync<JoinedRow>(`
      SELECT
        se.*,
        sm.id           AS m_id,
        sm.name         AS m_name,
        sm.shareAmount  AS m_shareAmount,
        sm.sharePercent AS m_sharePercent,
        sm.status       AS m_status,
        sm.friendId     AS m_friendId,
        sm.splitExpenseId AS m_splitExpenseId,
        sm.createdAt    AS m_createdAt,
        sm.updatedAt    AS m_updatedAt,
        sm.syncStatus   AS m_syncStatus,
        sm.lastSyncedAt AS m_lastSyncedAt,
        sm.deletedAt    AS m_deletedAt,
        t.merchant      AS t_merchant,
        t.notes         AS t_notes,
        t.date          AS t_date
      FROM split_expenses se
      LEFT JOIN split_members sm
        ON sm.splitExpenseId = se.id AND sm.deletedAt IS NULL
      LEFT JOIN transactions t ON t.id = se.transactionId
      WHERE se.deletedAt IS NULL
      ORDER BY se.createdAt DESC
    `);

    const expenseMap = new Map<
      string,
      {
        expense: SplitExpense;
        members: SplitMember[];
        transactionMerchant?: string;
        transactionDate?: string;
      }
    >();

    for (const row of rows) {
      if (!expenseMap.has(row.id)) {
        expenseMap.set(row.id, {
          expense: parseSplitExpense(row),
          members: [],
          transactionMerchant: row.t_merchant || row.t_notes || undefined,
          transactionDate: row.t_date ?? undefined,
        });
      }
      if (row.m_id) {
        expenseMap.get(row.id)!.members.push(
          parseSplitMember({
            id: row.m_id,
            name: row.m_name ?? '',
            shareAmount: row.m_shareAmount ?? 0,
            sharePercent: row.m_sharePercent ?? null,
            status: row.m_status ?? 'pending',
            friendId: row.m_friendId ?? undefined,
            splitExpenseId: row.m_splitExpenseId ?? '',
            createdAt: row.m_createdAt ?? '',
            updatedAt: row.m_updatedAt ?? '',
            syncStatus: row.m_syncStatus ?? 'pending',
            lastSyncedAt: row.m_lastSyncedAt ?? null,
            deletedAt: row.m_deletedAt ?? null,
            userId: null,
          } as unknown as SplitMemberRow),
        );
      }
    }

    return Array.from(expenseMap.values());
  },

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
      'SELECT * FROM split_members WHERE splitExpenseId = ? AND deletedAt IS NULL',
      [expense.id],
    );
    const members = memberRows.map(parseSplitMember);
    const transaction = await getDatabase().getFirstAsync<{
      merchant: string | null;
      notes: string | null;
      date: string;
    }>('SELECT merchant, notes, date FROM transactions WHERE id = ?', [expense.transactionId]);

    return {
      expense,
      members,
      transactionMerchant: transaction?.merchant || transaction?.notes || undefined,
      transactionDate: transaction?.date,
    };
  },

  async recordPayment(memberId: string, amountPaid: number) {
    const memberRow = await getDatabase().getFirstAsync<SplitMemberRow>(
      'SELECT * FROM split_members WHERE id = ?',
      [memberId],
    );
    if (!memberRow) throw new Error('Member not found');

    const member = parseSplitMember(memberRow);
    const remaining = member.shareAmount - amountPaid;
    const status: SplitStatus = remaining <= 0 ? 'paid' : 'pending';
    const updatedAt = new Date().toISOString();

    await getDatabase().runAsync(
      `UPDATE split_members
       SET status = ?, shareAmount = ?, updatedAt = ?, syncStatus = 'pending'
       WHERE id = ?`,
      [status, Math.max(remaining, 0), updatedAt, memberId],
    );

    await queueEntitySync('split_members', memberId, {
      ...member,
      status,
      shareAmount: Math.max(remaining, 0),
      updatedAt,
      syncStatus: 'pending',
    } as unknown as Record<string, unknown>);
  },

  async deleteSplit(splitId: string) {
    const now = new Date().toISOString();
    const memberRows = await getDatabase().getAllAsync<SplitMemberRow>(
      'SELECT * FROM split_members WHERE splitExpenseId = ? AND deletedAt IS NULL',
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

    await getDatabase().runAsync(
      `UPDATE split_expenses SET deletedAt = ?, updatedAt = ?, syncStatus = 'pending' WHERE id = ?`,
      [now, now, splitId],
    );

    const expenseRow = await getDatabase().getFirstAsync<SplitExpenseRow>(
      'SELECT * FROM split_expenses WHERE id = ?',
      [splitId],
    );
    if (expenseRow) {
      await queueEntitySync(
        'split_expenses',
        splitId,
        {
          ...parseSplitExpense(expenseRow),
          deletedAt: now,
          updatedAt: now,
          syncStatus: 'pending',
        } as unknown as Record<string, unknown>,
        'delete',
      );
    }
  },

  async getFriendBalances(): Promise<
    {
      friend: SplitFriend;
      totalPending: number;
    }[]
  > {
    const rows = await getDatabase().getAllAsync<{
      friendId: string;
      totalPending: number;
    }>(`
      SELECT sm.friendId, COALESCE(SUM(sm.shareAmount), 0) AS totalPending
      FROM split_members sm
      WHERE sm.friendId IS NOT NULL AND sm.status = 'pending' AND sm.deletedAt IS NULL
      GROUP BY sm.friendId
    `);

    const pendingByFriend = new Map(rows.map((r) => [r.friendId, r.totalPending]));
    const friends = await this.getFriends();

    return friends
      .map((friend) => ({ friend, totalPending: pendingByFriend.get(friend.id) ?? 0 }))
      .sort((a, b) => b.totalPending - a.totalPending);
  },

  async getFriendDetails(friendId: string): Promise<
    {
      expense: SplitExpense;
      member: SplitMember;
      transactionMerchant?: string;
      transactionDate?: string;
    }[]
  > {
    type FriendDetailRow = SplitMemberRow &
      SplitExpenseRow & {
        t_merchant: string | null;
        t_notes: string | null;
        t_date: string | null;
        e_id: string;
        e_transactionId: string;
        e_paidByUserId: string;
        e_totalAmount: number;
        e_splitMethod: string;
        e_notes: string | null;
        e_createdAt: string;
        e_updatedAt: string;
        e_syncStatus: string;
        e_lastSyncedAt: string | null;
        e_deletedAt: string | null;
        e_userId: string | null;
      };

    const rows = await getDatabase().getAllAsync<FriendDetailRow>(
      `
      SELECT
        sm.*,
        se.id               AS e_id,
        se.transactionId    AS e_transactionId,
        se.paidByUserId     AS e_paidByUserId,
        se.totalAmount      AS e_totalAmount,
        se.splitMethod      AS e_splitMethod,
        se.notes            AS e_notes,
        se.createdAt        AS e_createdAt,
        se.updatedAt        AS e_updatedAt,
        se.syncStatus       AS e_syncStatus,
        se.lastSyncedAt     AS e_lastSyncedAt,
        se.deletedAt        AS e_deletedAt,
        se.userId           AS e_userId,
        t.merchant          AS t_merchant,
        t.notes             AS t_notes,
        t.date              AS t_date
      FROM split_members sm
      JOIN split_expenses se
        ON se.id = sm.splitExpenseId AND se.deletedAt IS NULL
      LEFT JOIN transactions t ON t.id = se.transactionId
      WHERE sm.friendId = ? AND sm.deletedAt IS NULL
      ORDER BY sm.createdAt DESC
    `,
      [friendId],
    );

    return rows.map((row) => {
      const member = parseSplitMember({
        id: row.id,
        name: row.name,
        shareAmount: row.shareAmount,
        sharePercent: row.sharePercent ?? null,
        status: row.status,
        friendId: row.friendId,
        splitExpenseId: row.e_id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        syncStatus: row.syncStatus,
        lastSyncedAt: row.lastSyncedAt ?? null,
        deletedAt: row.deletedAt ?? null,
        userId: row.userId ?? null,
      } as unknown as SplitMemberRow);
      const expense = parseSplitExpense({
        id: row.e_id,
        transactionId: row.e_transactionId,
        paidByUserId: row.e_paidByUserId,
        totalAmount: row.e_totalAmount,
        splitMethod: row.e_splitMethod,
        notes: row.e_notes ?? null,
        createdAt: row.e_createdAt,
        updatedAt: row.e_updatedAt,
        syncStatus: row.e_syncStatus ?? 'pending',
        lastSyncedAt: row.e_lastSyncedAt ?? null,
        deletedAt: row.e_deletedAt ?? null,
        userId: row.e_userId ?? null,
      } as unknown as SplitExpenseRow);
      return {
        expense,
        member,
        transactionMerchant: row.t_merchant || row.t_notes || undefined,
        transactionDate: row.t_date ?? undefined,
      };
    });
  },

  async settleUpFriend(friendId: string): Promise<void> {
    const db = getDatabase();
    const pendingMembers = await db.getAllAsync<SplitMemberRow>(
      'SELECT * FROM split_members WHERE friendId = ? AND status = ? AND deletedAt IS NULL',
      [friendId, 'pending'],
    );
    if (pendingMembers.length === 0) return;

    const now = new Date().toISOString();

    await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
    try {
      for (const row of pendingMembers) {
        await db.runAsync(
          `UPDATE split_members SET status = ?, updatedAt = ?, syncStatus = 'pending' WHERE id = ?`,
          ['paid', now, row.id],
        );
      }
      await db.execAsync('COMMIT');
    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }

    for (const row of pendingMembers) {
      await queueEntitySync('split_members', row.id, {
        ...parseSplitMember(row),
        status: 'paid',
        updatedAt: now,
        syncStatus: 'pending',
      } as unknown as Record<string, unknown>);
    }
  },
};
