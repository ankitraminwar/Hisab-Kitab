import { SqlArg, executeSql } from "@/database/sqliteClient";
import { v4 as uuidv4 } from "uuid";

export type TransactionType = "expense" | "income" | "transfer";

export type RecurrenceType = "daily" | "weekly" | "monthly" | "yearly" | null;

export type TransactionEntity = {
  id: string;
  amount: number;
  type: TransactionType;
  categoryId?: string;
  accountId?: string;
  merchant?: string;
  notes?: string;
  tags?: string;
  date: number;
  isRecurring: boolean;
  recurrence?: RecurrenceType;
  createdAt: number;
  updatedAt: number;
};

export const createTransaction = async (
  data: Omit<TransactionEntity, "id" | "createdAt" | "updatedAt">,
) => {
  const id = uuidv4();
  const now = Date.now();
  await executeSql(
    `INSERT INTO transactions (id, amount, type, categoryId, accountId, merchant, notes, tags, date, isRecurring, recurrence, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      id,
      data.amount,
      data.type,
      data.categoryId ?? null,
      data.accountId ?? null,
      data.merchant ?? "",
      data.notes ?? "",
      data.tags ?? "",
      data.date,
      data.isRecurring ? 1 : 0,
      data.recurrence ?? null,
      now,
      now,
    ],
  );
  return { id, ...data, createdAt: now, updatedAt: now };
};

export const updateTransaction = async (
  id: string,
  patch: Partial<TransactionEntity>,
) => {
  const now = Date.now();
  const keys = Object.keys(patch)
    .map((key) => `${key} = ?`)
    .join(", ");
  const values = Object.values(patch);
  // complexity: handle no fields
  if (keys.length === 0) throw new Error("No update fields");
  await executeSql(
    `UPDATE transactions SET ${keys}, updatedAt = ? WHERE id = ?;`,
    [...values, now, id],
  );
  return await getTransactionById(id);
};

export const getTransactionById = async (
  id: string,
): Promise<TransactionEntity | null> => {
  const rows = await executeSql<TransactionEntity>(
    `SELECT * FROM transactions WHERE id = ?;`,
    [id],
  );
  return rows[0] ?? null;
};

export const getTransactions = async (filters?: {
  search?: string;
  categoryId?: string;
  accountId?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: number;
  endDate?: number;
  type?: TransactionType;
}): Promise<TransactionEntity[]> => {
  const clauses: string[] = [];
  const params: SqlArg[] = [];
  if (filters?.search) {
    clauses.push("(merchant LIKE ? OR notes LIKE ? OR tags LIKE ?)");
    const q = `%${filters.search}%`;
    params.push(q, q, q);
  }
  if (filters?.categoryId) {
    clauses.push("categoryId = ?");
    params.push(filters.categoryId);
  }
  if (filters?.accountId) {
    clauses.push("accountId = ?");
    params.push(filters.accountId);
  }
  if (filters?.type) {
    clauses.push("type = ?");
    params.push(filters.type);
  }
  if (filters?.minAmount != null) {
    clauses.push("amount >= ?");
    params.push(filters.minAmount);
  }
  if (filters?.maxAmount != null) {
    clauses.push("amount <= ?");
    params.push(filters.maxAmount);
  }
  if (filters?.startDate) {
    clauses.push("date >= ?");
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    clauses.push("date <= ?");
    params.push(filters.endDate);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const ordering = "ORDER BY date DESC, updatedAt DESC";
  return executeSql<TransactionEntity>(
    `SELECT * FROM transactions ${where} ${ordering};`,
    params,
  );
};

export const deleteTransaction = async (id: string) => {
  await executeSql("DELETE FROM transactions WHERE id = ?;", [id]);
  return true;
};
