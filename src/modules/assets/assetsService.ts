import { executeSql } from '@/database/sqliteClient';
import { v4 as uuidv4 } from 'uuid';

export type AssetType = 'bank' | 'cash' | 'stocks' | 'mutual_funds' | 'crypto' | 'gold' | 'other';

export type AssetEntity = {
  id: string;
  name: string;
  type: AssetType;
  value: number;
  createdAt: number;
  updatedAt: number;
};

export const createAsset = async (data: Omit<AssetEntity, 'id' | 'createdAt' | 'updatedAt'>) => {
  const id = uuidv4();
  const now = Date.now();
  await executeSql(
    `INSERT INTO assets (id, name, type, value, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?);`,
    [id, data.name, data.type, data.value, now, now],
  );
  return { ...data, id, createdAt: now, updatedAt: now };
};

export const getAssets = async () => executeSql<AssetEntity>('SELECT * FROM assets ORDER BY updatedAt DESC;');

export const updateAsset = async (id: string, patch: Partial<AssetEntity>) => {
  const keys = Object.keys(patch).map((k) => `${k} = ?`).join(', ');
  if (!keys) throw new Error('No update fields');
  await executeSql(`UPDATE assets SET ${keys}, updatedAt = ? WHERE id = ?;`, [...Object.values(patch), Date.now(), id]);
};

export const deleteAsset = async (id: string) => {
  await executeSql('DELETE FROM assets WHERE id = ?;', [id]);
};
