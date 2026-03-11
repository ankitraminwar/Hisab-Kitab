import { executeSql } from "@/database/sqliteClient";
import { v4 as uuidv4 } from "uuid";

export type GoalEntity = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: number | null;
  createdAt: number;
  updatedAt: number;
};

export const createGoal = async (
  goal: Omit<GoalEntity, "id" | "createdAt" | "updatedAt">,
) => {
  const id = uuidv4();
  const now = Date.now();
  await executeSql(
    `INSERT INTO goals (id, name, targetAmount, currentAmount, deadline, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      id,
      goal.name,
      goal.targetAmount,
      goal.currentAmount,
      goal.deadline,
      now,
      now,
    ],
  );
  return { id, ...goal, createdAt: now, updatedAt: now };
};

export const getGoals = async (): Promise<GoalEntity[]> => {
  return executeSql<GoalEntity>("SELECT * FROM goals ORDER BY deadline ASC;");
};

export const updateGoal = async (id: string, patch: Partial<GoalEntity>) => {
  const now = Date.now();
  const keys = Object.keys(patch)
    .map((key) => `${key} = ?`)
    .join(", ");
  const values = Object.values(patch);
  if (!keys) throw new Error("No fields to update");
  await executeSql(`UPDATE goals SET ${keys}, updatedAt = ? WHERE id = ?;`, [
    ...values,
    now,
    id,
  ]);
  const rows = await executeSql<GoalEntity>(
    "SELECT * FROM goals WHERE id = ?;",
    [id],
  );
  return rows[0] ?? null;
};

export const deleteGoal = async (id: string) => {
  await executeSql("DELETE FROM goals WHERE id = ?;", [id]);
  return true;
};
