import type { DatabaseSync } from "node:sqlite";

export interface Migration {
  version: number;
  name: string;
  /**
   * ANSI-standard SQL DDL (UUID TEXT primary keys, ISO-8601 UTC timestamps,
   * explicit constraints & indexes) so schemas port cleanly to PostgreSQL/MySQL.
   */
  sql: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: "001_initial_schema",
    sql: `
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        google_sub TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        picture TEXT,
        username TEXT UNIQUE,
        terms_accepted_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_accounts_email
        ON accounts (email);

      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        room_code TEXT NOT NULL,
        ended_reason TEXT NOT NULL CHECK (ended_reason IN ('completed', 'host_ended')),
        winner_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
        winner_name TEXT,
        winner_is_bot INTEGER NOT NULL DEFAULT 0,
        seat_count INTEGER NOT NULL CHECK (seat_count >= 2 AND seat_count <= 6),
        human_count INTEGER NOT NULL CHECK (human_count >= 0),
        bot_count INTEGER NOT NULL CHECK (bot_count >= 0),
        timer_enabled INTEGER NOT NULL DEFAULT 0,
        one_time_guess INTEGER NOT NULL DEFAULT 0,
        duke_blocks_tax INTEGER NOT NULL DEFAULT 0,
        card_theme TEXT NOT NULL DEFAULT 'classic',
        total_actions INTEGER NOT NULL DEFAULT 0,
        total_challenges INTEGER NOT NULL DEFAULT 0,
        total_blocks INTEGER NOT NULL DEFAULT 0,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_matches_finished_at
        ON matches (finished_at DESC);

      CREATE TABLE IF NOT EXISTS match_participants (
        id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        seat_id TEXT NOT NULL,
        account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
        nickname TEXT NOT NULL,
        is_bot INTEGER NOT NULL DEFAULT 0,
        bot_difficulty TEXT CHECK (bot_difficulty IS NULL OR bot_difficulty IN ('easy', 'normal', 'hard')),
        is_winner INTEGER NOT NULL DEFAULT 0,
        final_influence INTEGER NOT NULL DEFAULT 0,
        final_coins INTEGER NOT NULL DEFAULT 0,
        peak_coins INTEGER NOT NULL DEFAULT 0,
        attacks_made INTEGER NOT NULL DEFAULT 0,
        times_targeted INTEGER NOT NULL DEFAULT 0,
        challenges_made INTEGER NOT NULL DEFAULT 0,
        blocks_made INTEGER NOT NULL DEFAULT 0,
        bluffs_made INTEGER NOT NULL DEFAULT 0,
        UNIQUE (match_id, seat_id)
      );

      CREATE INDEX IF NOT EXISTS idx_match_participants_match_id
        ON match_participants (match_id);

      CREATE INDEX IF NOT EXISTS idx_match_participants_account_id
        ON match_participants (account_id);

      CREATE TABLE IF NOT EXISTS player_stats (
        account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        matches_played INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        human_matches_played INTEGER NOT NULL DEFAULT 0,
        human_wins INTEGER NOT NULL DEFAULT 0,
        current_streak INTEGER NOT NULL DEFAULT 0,
        best_streak INTEGER NOT NULL DEFAULT 0,
        total_attacks INTEGER NOT NULL DEFAULT 0,
        total_targeted INTEGER NOT NULL DEFAULT 0,
        total_challenges INTEGER NOT NULL DEFAULT 0,
        total_blocks INTEGER NOT NULL DEFAULT 0,
        total_bluffs INTEGER NOT NULL DEFAULT 0,
        highest_coins INTEGER NOT NULL DEFAULT 0,
        last_played_at TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_player_stats_leaderboard
        ON player_stats (wins DESC, matches_played DESC, best_streak DESC);

      CREATE INDEX IF NOT EXISTS idx_player_stats_pvp_leaderboard
        ON player_stats (human_wins DESC, human_matches_played DESC, best_streak DESC);
    `,
  },
  {
    version: 2,
    name: "002_dynamic_points",
    sql: `
      ALTER TABLE match_participants ADD COLUMN placement_rank INTEGER;
      ALTER TABLE match_participants ADD COLUMN points_earned INTEGER NOT NULL DEFAULT 0;

      ALTER TABLE player_stats ADD COLUMN total_points INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE player_stats ADD COLUMN human_points INTEGER NOT NULL DEFAULT 0;

      CREATE INDEX IF NOT EXISTS idx_player_stats_points_leaderboard
        ON player_stats (total_points DESC, wins DESC, matches_played DESC, best_streak DESC);

      CREATE INDEX IF NOT EXISTS idx_player_stats_pvp_points_leaderboard
        ON player_stats (human_points DESC, human_wins DESC, human_matches_played DESC, best_streak DESC);
    `,
  },
  {
    version: 3,
    name: "003_profiles_and_nicknames",
    sql: `
      CREATE TABLE IF NOT EXISTS account_nicknames (
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        nickname TEXT NOT NULL,
        nickname_key TEXT NOT NULL,
        use_count INTEGER NOT NULL DEFAULT 1 CHECK (use_count >= 1),
        first_used_at TEXT NOT NULL,
        last_used_at TEXT NOT NULL,
        PRIMARY KEY (account_id, nickname_key)
      );

      CREATE INDEX IF NOT EXISTS idx_account_nicknames_rank
        ON account_nicknames (account_id, use_count DESC, last_used_at DESC);

      ALTER TABLE matches ADD COLUMN match_mode TEXT NOT NULL DEFAULT 'private';
      ALTER TABLE match_participants ADD COLUMN guess_bonus INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE player_stats ADD COLUMN total_guess_hits INTEGER NOT NULL DEFAULT 0;

      CREATE INDEX IF NOT EXISTS idx_matches_leaderboard_period
        ON matches (ended_reason, bot_count, human_count, finished_at DESC);

      INSERT OR IGNORE INTO account_nicknames (
        account_id, nickname, nickname_key, use_count, first_used_at, last_used_at
      )
      SELECT
        mp.account_id,
        (
          SELECT mp2.nickname
          FROM match_participants mp2
          INNER JOIN matches m2 ON m2.id = mp2.match_id
          WHERE mp2.account_id = mp.account_id
            AND LOWER(TRIM(mp2.nickname)) = LOWER(TRIM(mp.nickname))
          ORDER BY m2.finished_at DESC
          LIMIT 1
        ) AS nickname,
        LOWER(TRIM(mp.nickname)) AS nickname_key,
        COUNT(*) AS use_count,
        MIN(m.finished_at) AS first_used_at,
        MAX(m.finished_at) AS last_used_at
      FROM match_participants mp
      INNER JOIN matches m ON m.id = mp.match_id
      INNER JOIN accounts a ON a.id = mp.account_id
      WHERE mp.account_id IS NOT NULL
        AND mp.is_bot = 0
        AND LENGTH(TRIM(mp.nickname)) > 0
      GROUP BY mp.account_id, LOWER(TRIM(mp.nickname));

      UPDATE player_stats
      SET
        human_matches_played = COALESCE((
          SELECT COUNT(*)
          FROM match_participants mp
          INNER JOIN matches m ON m.id = mp.match_id
          WHERE mp.account_id = player_stats.account_id
            AND m.ended_reason = 'completed'
            AND m.human_count >= 2
            AND m.bot_count = 0
            AND m.total_actions >= 2
        ), 0),
        human_wins = COALESCE((
          SELECT SUM(CASE WHEN mp.is_winner = 1 THEN 1 ELSE 0 END)
          FROM match_participants mp
          INNER JOIN matches m ON m.id = mp.match_id
          WHERE mp.account_id = player_stats.account_id
            AND m.ended_reason = 'completed'
            AND m.human_count >= 2
            AND m.bot_count = 0
            AND m.total_actions >= 2
        ), 0),
        human_points = COALESCE((
          SELECT SUM(mp.points_earned)
          FROM match_participants mp
          INNER JOIN matches m ON m.id = mp.match_id
          WHERE mp.account_id = player_stats.account_id
            AND m.ended_reason = 'completed'
            AND m.human_count >= 2
            AND m.bot_count = 0
            AND m.total_actions >= 2
        ), 0);
    `,
  },
];

export const LATEST_SCHEMA_VERSION =
  MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;

export function runSqliteMigrations(db: DatabaseSync): number {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set<number>(
    (
      db
        .prepare("SELECT version FROM schema_migrations ORDER BY version ASC")
        .all() as { version: number }[]
    ).map((r) => Number(r.version)),
  );

  const recordMigration = db.prepare(
    "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(migration.sql);
      recordMigration.run(
        migration.version,
        migration.name,
        new Date().toISOString(),
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  return LATEST_SCHEMA_VERSION;
}
