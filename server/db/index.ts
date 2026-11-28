import { join } from "node:path";
import { createMemoryDatabase } from "./memory";
import { createSqliteDatabase } from "./sqlite";
import type { AppDatabase, DatabaseDriver } from "./types";

export * from "./types";
export * from "./helpers";
export {
  MemoryAccountStore,
  MemoryNicknameRepository,
  MemoryStatsRepository,
  createMemoryDatabase,
} from "./memory";
export {
  SqliteAccountStore,
  SqliteNicknameRepository,
  SqliteStatsRepository,
  createSqliteDatabase,
} from "./sqlite";
export { MIGRATIONS, LATEST_SCHEMA_VERSION } from "./migrations";

export interface DatabaseConfig {
  driver?: DatabaseDriver | string;
  dataDir?: string;
  sqlitePath?: string;
  legacyAccountsFile?: string;
}

export function createDatabase(config: DatabaseConfig = {}): AppDatabase {
  const driver = (
    config.driver ??
    process.env.DATABASE_DRIVER ??
    "sqlite"
  )
    .trim()
    .toLowerCase();

  if (driver === "memory") {
    return createMemoryDatabase();
  }

  if (driver === "sqlite") {
    const dataDir =
      config.dataDir ??
      process.env.COUP_DATA_DIR?.trim() ??
      join(process.cwd(), "data");
    const dbPath =
      config.sqlitePath ??
      process.env.DATABASE_PATH?.trim() ??
      join(dataDir, "coup.db");
    return createSqliteDatabase(dbPath, {
      legacyAccountsFile:
        config.legacyAccountsFile ?? join(dataDir, "accounts.json"),
    });
  }

  throw Error(
    `DATABASE_DRIVER="${driver}" belum diimplementasikan. Implementasikan adapter AppDatabase (AccountStore + StatsRepository) di server/db/ menggunakan skema MIGRATIONS yang sama.`,
  );
}
