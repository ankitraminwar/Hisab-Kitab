import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'trackBuddy.db';

let database: SQLite.WebSQLDatabase | null = null;

const getDatabase = () => {
  if (database) return database;
  if (Platform.OS === 'web' && typeof window === 'undefined') return null;
  database = SQLite.openDatabase(DB_NAME);
  return database;
};

export type SqlArg = string | number | boolean | null | undefined;

export function executeSql<T>(sql: string, params: SqlArg[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    if (!db) {
      resolve([]);
      return;
    }

    const normalized = params.map((param) => {
      if (typeof param === 'boolean') return param ? 1 : 0;
      return param ?? null;
    });

    db.transaction((tx) => {
      tx.executeSql(
        sql,
        normalized,
        (_, result) => {
          const rows: T[] = [];
          for (let i = 0; i < result.rows.length; i += 1) {
            rows.push(result.rows.item(i));
          }
          resolve(rows);
        },
        (_, err) => {
          reject(err);
          return false;
        },
      );
    }, reject);
  });
}
