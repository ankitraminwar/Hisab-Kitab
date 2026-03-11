import { executeSql } from "@/database/sqliteClient";
import { v4 as uuidv4 } from "uuid";

export type BudgetEntity = {
  id: string;
  categoryId: string;
  limitAmount: number;
  month: string;
  createdAt: number;
  updatedAt: number;
};

export const createBudget = async (
  budget: Omit<BudgetEntity, "id" | "createdAt" | "updatedAt">,
) => {
  const id = uuidv4();
  const now = Date.now();
  await executeSql(
    `INSERT INTO budgets (id, categoryId, limitAmount, month, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?);`,
    [id, budget.categoryId, budget.limitAmount, budget.month, now, now],
  );
  return { id, ...budget, createdAt: now, updatedAt: now };
};

export const getBudgets = async (): Promise<BudgetEntity[]> => {
  return executeSql<BudgetEntity>("SELECT * FROM budgets ORDER BY month DESC;");
};

export const updateBudget = async (
  id: string,
  patch: Partial<BudgetEntity>,
) => {
  const now = Date.now();
  const keys = Object.keys(patch)
    .map((key) => `${key} = ?`)
    .join(", ");
  const values = Object.values(patch);
  if (!keys) throw new Error("No fields to update");
  await executeSql(`UPDATE budgets SET ${keys}, updatedAt = ? WHERE id = ?;`, [
    ...values,
    now,
    id,
  ]);
  const rows = await executeSql<BudgetEntity>(
    "SELECT * FROM budgets WHERE id = ?;",
    [id],
  );
  return rows[0] ?? null;
};

export const deleteBudget = async (id: string) => {
  await executeSql("DELETE FROM budgets WHERE id = ?;", [id]);
  return true;
};
