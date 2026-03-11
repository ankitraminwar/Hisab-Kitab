import * as SQLite from "expo-sqlite";

const DB_NAME = "trackBuddy.db";

export const db = SQLite.openDatabase(DB_NAME);

export function executeSql<T>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        sql,
        params,
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
