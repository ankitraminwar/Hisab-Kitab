import type * as SQLite from 'expo-sqlite';

type Migration = {
  version: number;
  name: string;
  run: (db: SQLite.SQLiteDatabase) => Promise<void>;
};

const ensureMigrationsTable = async (db: SQLite.SQLiteDatabase) => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
};

const getAppliedVersions = async (db: SQLite.SQLiteDatabase) => {
  const rows = await db.getAllAsync<{ version: number }>('SELECT version FROM _migrations');
  return new Set(rows.map((row) => row.version));
};

/**
 * All historical migrations (v1-v9) have been consolidated into the base schema
 * in database/index.ts. This runner now only exists for future migrations that
 * may be added post-launch. Fresh installs get the complete schema directly;
 * existing installs already ran v1-v9 via the old MigrationRunner.
 */
const migrations: Migration[] = [];

/** Clean up any orphaned _old tables left by previous migration renames. */
const cleanupOrphanedTables = async (db: SQLite.SQLiteDatabase) => {
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_old'`,
  );
  for (const { name } of rows) {
    await db.execAsync(`DROP TABLE IF EXISTS "${name}"`);
  }
};

export const runMigrations = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  await ensureMigrationsTable(db);
  await cleanupOrphanedTables(db);

  if (migrations.length === 0) return;

  const applied = await getAppliedVersions(db);
  const pending = migrations.filter((m) => !applied.has(m.version));

  for (const migration of pending) {
    await migration.run(db);
    await db.runAsync('INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)', [
      migration.version,
      migration.name,
      new Date().toISOString(),
    ]);
  }
};
