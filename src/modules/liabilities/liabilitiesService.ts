import { executeSql } from '@/database/sqliteClient';
import { v4 as uuidv4 } from 'uuid';

export type LiabilityType = 'credit_card' | 'loan' | 'mortgage' | 'other';

export type LiabilityEntity = {
  id: string;
  name: string;
  type: LiabilityType;
  amount: number;
  createdAt: number;
  updatedAt: number;
};

export const createLiability = async (data: Omit<LiabilityEntity, 'id' | 'createdAt' | 'updatedAt'>) => {
  const id = uuidv4();
  const now = Date.now();
  await executeSql(
    `INSERT INTO liabilities (id, name, type, amount, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?);`,
    [id, data.name, data.type, data.amount, now, now],
  );
  return { ...data, id, createdAt: now, updatedAt: now };
};

export const getLiabilities = async () => executeSql<LiabilityEntity>('SELECT * FROM liabilities ORDER BY updatedAt DESC;');

export const deleteLiability = async (id: string) => {
  await executeSql('DELETE FROM liabilities WHERE id = ?;', [id]);
};
