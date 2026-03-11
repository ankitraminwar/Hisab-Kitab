import { executeSql } from "@/database/sqliteClient";
import { v4 as uuidv4 } from "uuid";

export type AccountType = "cash" | "bank" | "upi" | "credit_card" | "wallet";

export type AccountEntity = {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  createdAt: number;
  updatedAt: number;
};

export const createAccount = async (
  data: Omit<AccountEntity, "id" | "createdAt" | "updatedAt">,
) => {
  const id = uuidv4();
  const now = Date.now();
  await executeSql(
    `INSERT INTO accounts (id, name, type, balance, currency, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      id,
      data.name,
      data.type,
      data.balance || 0,
      data.currency || "INR",
      now,
      now,
    ],
  );
  return { id, ...data, createdAt: now, updatedAt: now };
};

export const getAccounts = async (): Promise<AccountEntity[]> => {
  return executeSql<AccountEntity>("SELECT * FROM accounts ORDER BY name ASC;");
};

export const updateAccount = async (
  id: string,
  patch: Partial<AccountEntity>,
) => {
  const now = Date.now();
  const keys = Object.keys(patch)
    .map((key) => `${key} = ?`)
    .join(", ");
  const values = Object.values(patch);
  if (!keys) throw new Error("No fields to update");
  await executeSql(`UPDATE accounts SET ${keys}, updatedAt = ? WHERE id = ?;`, [
    ...values,
    now,
    id,
  ]);
  const rows = await executeSql<AccountEntity>(
    "SELECT * FROM accounts WHERE id = ?;",
    [id],
  );
  return rows[0] ?? null;
};

export const deleteAccount = async (id: string) => {
  await executeSql("DELETE FROM accounts WHERE id = ?;", [id]);
  return true;
};
