import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { io as client } from "socket.io-client";
import { describe, expect, it } from "vitest";
import {
  derivePlayerStyle,
  getWeeklyPeriodRange,
} from "../domain/player-style";
import { ApiService } from "../server/api";
import { AuthService } from "../server/auth";
import {
  createDatabase,
  createSqliteDatabase,
  LATEST_SCHEMA_VERSION,
  MIGRATIONS,
  type AppDatabase,
  type RecordMatchInput,
} from "../server/db";
import { attach } from "../server/socket";

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), "coup-stage-a-"));
}

function makeMatch(overrides: Partial<RecordMatchInput>): RecordMatchInput {
  return {
    matchId: "m-default",
    roomCode: "SECRETROOM",
    matchMode: "private",
    endedReason: "completed",
    winnerIsBot: false,
    seatCount: 2,
    humanCount: 2,
    botCount: 0,
    timerEnabled: false,
    oneTimeGuess: false,
    dukeBlocksTax: false,
    cardTheme: "classic",
    totalActions: 6,
    totalChallenges: 1,
    totalBlocks: 1,
    startedAt: "2026-11-25T10:00:00.000Z",
    finishedAt: "2026-11-25T10:05:00.000Z",
    participants: [],
    ...overrides,
  };
}

describe("domain/player-style", () => {
  it("derives playstyle titles deterministically from career metrics", () => {
    expect(derivePlayerStyle(null).id).toBe("newcomer");
    expect(
      derivePlayerStyle({
        matchesPlayed: 2,
        wins: 2,
        winRate: 100,
        totalBluffs: 10,
        totalChallenges: 0,
        totalBlocks: 0,
        totalAttacks: 4,
        highestCoins: 10,
      }).id,
    ).toBe("newcomer");

    expect(
      derivePlayerStyle({
        matchesPlayed: 5,
        wins: 2,
        winRate: 40,
        totalBluffs: 10,
        totalChallenges: 1,
        totalBlocks: 1,
        totalAttacks: 3,
        highestCoins: 6,
      }).id,
    ).toBe("bluffer");

    expect(
      derivePlayerStyle({
        matchesPlayed: 5,
        wins: 2,
        winRate: 40,
        totalBluffs: 1,
        totalChallenges: 9,
        totalBlocks: 1,
        totalAttacks: 3,
        highestCoins: 6,
      }).id,
    ).toBe("challenger");

    expect(
      derivePlayerStyle({
        matchesPlayed: 6,
        wins: 4,
        winRate: 66.7,
        totalBluffs: 1,
        totalChallenges: 1,
        totalBlocks: 1,
        totalAttacks: 5,
        highestCoins: 8,
      }).id,
    ).toBe("ruler");
  });

  it("calculates weekly WIB (UTC+7) Monday 00:00 to Sunday 23:59 range accurately", () => {
    // Saturday 2026-11-28 15:00 WIB = 2026-11-28T08:00:00.000Z
    const sat = getWeeklyPeriodRange(new Date("2026-11-28T08:00:00.000Z"));
    // Monday 2026-11-23 00:00:00 WIB = 2026-11-22T17:00:00.000Z
    expect(sat.startIso).toBe("2026-11-22T17:00:00.000Z");
    // Sunday 2026-11-29 23:59:59.999 WIB = 2026-11-29T16:59:59.999Z
    expect(sat.endIso).toBe("2026-11-29T16:59:59.999Z");
    expect(sat.exclusiveEndIso).toBe("2026-11-29T17:00:00.000Z");

    // Sunday 2026-11-29 23:30 WIB = 2026-11-29T16:30:00.000Z (still same week!)
    const sunLate = getWeeklyPeriodRange(new Date("2026-11-29T16:30:00.000Z"));
    expect(sunLate.startIso).toBe("2026-11-22T17:00:00.000Z");

    // Monday 2026-11-30 00:01 WIB = 2026-11-29T17:01:00.000Z (new week!)
    const monEarly = getWeeklyPeriodRange(new Date("2026-11-29T17:01:00.000Z"));
    expect(monEarly.startIso).toBe("2026-11-29T17:00:00.000Z");
  });
});

describe.each(["sqlite", "memory"] as const)(
  "Stage A database rules (%s driver)",
  (driver) => {
    function openDb(): { db: AppDatabase; cleanup: () => void } {
      if (driver === "memory") {
        const db = createDatabase({ driver: "memory" });
        return { db, cleanup: () => db.close() };
      }
      const dir = makeTempDir();
      const db = createDatabase({ driver: "sqlite", dataDir: dir });
      return {
        db,
        cleanup: () => {
          db.close();
          rmSync(dir, { recursive: true, force: true });
        },
      };
    }

    it("counts PvP strictly when all seats are human (botCount === 0) and supports weekly vs all_time leaderboard", () => {
      const { db, cleanup } = openDb();
      try {
        const a = db.accounts.upsertGoogleProfile({
          sub: "sub-1",
          email: "a@example.com",
          name: "Alya",
        });
        db.accounts.completeOnboarding(a.id, "alya", "2026-11-01T00:00:00Z");

        const b = db.accounts.upsertGoogleProfile({
          sub: "sub-2",
          email: "b@example.com",
          name: "Budi",
        });
        db.accounts.completeOnboarding(b.id, "budi", "2026-11-01T00:00:00Z");

        // 1. Mixed table (2 humans + 1 bot) this week -> counts in ALL, NOT in PvP!
        db.stats.recordMatch(
          makeMatch({
            matchId: "m-mixed",
            seatCount: 3,
            humanCount: 2,
            botCount: 1,
            winnerAccountId: b.id,
            winnerName: "BudiMix",
            finishedAt: "2026-11-25T10:05:00.000Z",
            participants: [
              {
                seatId: "s1",
                accountId: b.id,
                nickname: "BudiMix",
                isBot: false,
                isWinner: true,
                placementRank: 1,
                pointsEarned: 3,
                finalInfluence: 2,
                finalCoins: 5,
                peakCoins: 8,
                attacksMade: 2,
                timesTargeted: 1,
                challengesMade: 1,
                blocksMade: 1,
                bluffsMade: 1,
              },
              {
                seatId: "s2",
                accountId: a.id,
                nickname: "AlyaMix",
                isBot: false,
                isWinner: false,
                placementRank: 2,
                pointsEarned: 1,
                finalInfluence: 0,
                finalCoins: 2,
                peakCoins: 4,
                attacksMade: 1,
                timesTargeted: 2,
                challengesMade: 0,
                blocksMade: 0,
                bluffsMade: 0,
              },
              {
                seatId: "s3",
                nickname: "Bot1",
                isBot: true,
                botDifficulty: "hard",
                isWinner: false,
                placementRank: 3,
                pointsEarned: 0,
                finalInfluence: 0,
                finalCoins: 0,
                peakCoins: 3,
                attacksMade: 0,
                timesTargeted: 1,
                challengesMade: 0,
                blocksMade: 0,
                bluffsMade: 0,
              },
            ],
          }),
        );

        // 2. Pure PvP (2 humans, 0 bots) LAST week -> counts in All-Time PvP, NOT Weekly PvP
        db.stats.recordMatch(
          makeMatch({
            matchId: "m-pvp-old",
            winnerAccountId: b.id,
            winnerName: "BudiOld",
            startedAt: "2026-11-18T10:00:00.000Z",
            finishedAt: "2026-11-18T10:08:00.000Z",
            participants: [
              {
                seatId: "s1",
                accountId: b.id,
                nickname: "BudiOld",
                isBot: false,
                isWinner: true,
                placementRank: 1,
                pointsEarned: 2,
                finalInfluence: 1,
                finalCoins: 4,
                peakCoins: 7,
                attacksMade: 2,
                timesTargeted: 1,
                challengesMade: 1,
                blocksMade: 0,
                bluffsMade: 1,
              },
              {
                seatId: "s2",
                accountId: a.id,
                nickname: "AlyaOld",
                isBot: false,
                isWinner: false,
                placementRank: 2,
                pointsEarned: 0,
                finalInfluence: 0,
                finalCoins: 1,
                peakCoins: 3,
                attacksMade: 0,
                timesTargeted: 2,
                challengesMade: 1,
                blocksMade: 0,
                bluffsMade: 0,
              },
            ],
          }),
        );

        // 3. Pure PvP THIS week with +1 Guess bonus -> Alya beats Budi
        db.stats.recordMatch(
          makeMatch({
            matchId: "m-pvp-week",
            oneTimeGuess: true,
            winnerAccountId: a.id,
            winnerName: "AlyaPro",
            startedAt: "2026-11-26T12:00:00.000Z",
            finishedAt: "2026-11-26T12:06:00.000Z",
            participants: [
              {
                seatId: "s1",
                accountId: a.id,
                nickname: "AlyaPro",
                isBot: false,
                isWinner: true,
                placementRank: 1,
                pointsEarned: 3,
                guessBonus: 1,
                finalInfluence: 2,
                finalCoins: 6,
                peakCoins: 9,
                attacksMade: 2,
                timesTargeted: 1,
                challengesMade: 1,
                blocksMade: 1,
                bluffsMade: 2,
              },
              {
                seatId: "s2",
                accountId: b.id,
                nickname: "BudiPro",
                isBot: false,
                isWinner: false,
                placementRank: 2,
                pointsEarned: 0,
                guessBonus: 0,
                finalInfluence: 0,
                finalCoins: 2,
                peakCoins: 5,
                attacksMade: 1,
                timesTargeted: 2,
                challengesMade: 0,
                blocksMade: 1,
                bluffsMade: 0,
              },
            ],
          }),
        );

        // 4. Match with < 2 actions -> stored in history, excluded from leaderboard points
        db.stats.recordMatch(
          makeMatch({
            matchId: "m-too-short",
            totalActions: 1,
            winnerAccountId: b.id,
            winnerName: "BudiShort",
            finishedAt: "2026-11-27T12:00:00.000Z",
            participants: [
              {
                seatId: "s1",
                accountId: b.id,
                nickname: "BudiShort",
                isBot: false,
                isWinner: true,
                placementRank: 1,
                pointsEarned: 2,
                finalInfluence: 2,
                finalCoins: 2,
                peakCoins: 2,
                attacksMade: 1,
                timesTargeted: 0,
                challengesMade: 0,
                blocksMade: 0,
                bluffsMade: 0,
              },
              {
                seatId: "s2",
                accountId: a.id,
                nickname: "AlyaShort",
                isBot: false,
                isWinner: false,
                placementRank: 2,
                pointsEarned: 0,
                finalInfluence: 0,
                finalCoins: 2,
                peakCoins: 2,
                attacksMade: 0,
                timesTargeted: 1,
                challengesMade: 0,
                blocksMade: 0,
                bluffsMade: 0,
              },
            ],
          }),
        );

        const statsA = db.stats.getPlayerStats(a.id)!;
        const statsB = db.stats.getPlayerStats(b.id)!;
        // Mixed table excluded from humanMatchesPlayed / humanPoints:
        expect(statsA.matchesPlayed).toBe(3);
        expect(statsA.humanMatchesPlayed).toBe(2);
        expect(statsA.humanPoints).toBe(3);
        expect(statsA.totalPoints).toBe(4);
        expect(statsA.totalGuessHits).toBe(1);

        expect(statsB.matchesPlayed).toBe(3);
        expect(statsB.humanMatchesPlayed).toBe(2);
        expect(statsB.humanPoints).toBe(2); // m-mixed (3pts) NOT counted in PvP!
        expect(statsB.totalPoints).toBe(5);

        const now = new Date("2026-11-28T08:00:00.000Z");

        // Weekly PvP: only m-pvp-week counts (Alya = 3 pts, Budi = 0 pts)
        const weeklyPvp = db.stats.getLeaderboardPage({
          mode: "pvp",
          period: "weekly",
          now,
          limit: 1,
          viewerAccountId: b.id,
        });
        expect(weeklyPvp.totalEntries).toBe(2);
        expect(weeklyPvp.entries).toHaveLength(1);
        expect(weeklyPvp.entries[0].username).toBe("alya");
        expect(weeklyPvp.entries[0].points).toBe(3);
        // Viewer outside page limit still gets myEntry!
        expect(weeklyPvp.myEntry?.username).toBe("budi");
        expect(weeklyPvp.myEntry?.rank).toBe(2);
        expect(weeklyPvp.myEntry?.points).toBe(0);

        // Weekly All: m-mixed + m-pvp-week (Alya = 1+3 = 4 pts, Budi = 3+0 = 3 pts)
        const weeklyAll = db.stats.getLeaderboardPage({
          mode: "all",
          period: "weekly",
          now,
        });
        expect(weeklyAll.entries[0].username).toBe("alya");
        expect(weeklyAll.entries[0].points).toBe(4);
        expect(weeklyAll.entries[1].username).toBe("budi");
        expect(weeklyAll.entries[1].points).toBe(3);

        // History filters & no roomCode leak
        const pvpHistory = db.stats.getMatchHistory(a.id, {
          scope: "pvp",
          result: "win",
        });
        expect(pvpHistory.total).toBe(1);
        expect(pvpHistory.items[0].matchId).toBe("m-pvp-week");
        expect(pvpHistory.items[0].guessBonus).toBe(1);
        expect("roomCode" in pvpHistory.items[0]).toBe(false);

        const nonPvpHistory = db.stats.getMatchHistory(a.id, {
          scope: "non_pvp",
        });
        expect(nonPvpHistory.total).toBe(1);
        expect(nonPvpHistory.items[0].matchId).toBe("m-mixed");

        // Match detail hides roomCode and exposes public usernames
        const detail = db.stats.getMatchDetail("m-pvp-week")!;
        expect(detail.isPurePvp).toBe(true);
        expect("roomCode" in detail).toBe(false);
        expect(detail.participants[0].username).toBe("alya");
        expect(detail.participants[0].guessBonus).toBe(1);
      } finally {
        cleanup();
      }
    });

    it("tracks, deduplicates case-insensitively, ranks, and deletes account nickname suggestions", () => {
      const { db, cleanup } = openDb();
      try {
        const a = db.accounts.upsertGoogleProfile({
          sub: "sub-nick",
          email: "nick@example.com",
          name: "Nadia",
        });
        db.accounts.completeOnboarding(a.id, "nadia", "2026-11-01T00:00:00Z");

        db.nicknames.recordUsage(a.id, "Lord Nadia", "2026-11-20T10:00:00.000Z");
        db.nicknames.recordUsage(a.id, "lord nadia", "2026-11-21T10:00:00.000Z");
        db.nicknames.recordUsage(a.id, "Lord NADIA", "2026-11-22T10:00:00.000Z");
        db.nicknames.recordUsage(a.id, "Nadia Santai", "2026-11-25T10:00:00.000Z");

        const last = db.nicknames.getLastUsed(a.id);
        expect(last?.nickname).toBe("Nadia Santai");

        const list = db.nicknames.listForAccount(a.id);
        expect(list).toHaveLength(2);
        // Most frequently used comes first with latest capitalization preserved
        expect(list[0].nickname).toBe("Lord NADIA");
        expect(list[0].useCount).toBe(3);
        expect(list[1].nickname).toBe("Nadia Santai");
        expect(list[1].useCount).toBe(1);

        expect(db.nicknames.deleteForAccount(a.id, "lord nadia")).toBe(true);
        expect(db.nicknames.listForAccount(a.id)).toHaveLength(1);
      } finally {
        cleanup();
      }
    });
  },
);

describe("SQLite migration v2 -> v3 backfill & pure-PvP recalculation", () => {
  it("backfills account_nicknames and removes mixed human+bot matches from human_points", () => {
    const dir = makeTempDir();
    try {
      const dbPath = join(dir, "legacy-v2.db");
      const raw = new DatabaseSync(dbPath);
      raw.exec(`
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
      `);
      for (const m of MIGRATIONS.filter((x) => x.version <= 2)) {
        raw.exec(m.sql);
        raw
          .prepare(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
          )
          .run(m.version, m.name, "2026-11-20T00:00:00.000Z");
      }

      raw
        .prepare(
          `INSERT INTO accounts (id, google_sub, email, name, username, terms_accepted_at, created_at, updated_at)
           VALUES ('acc-1', 'sub-1', 'u1@example.com', 'User 1', 'user_one', '2026-11-20T00:00:00Z', '2026-11-20T00:00:00Z', '2026-11-20T00:00:00Z')`,
        )
        .run();

      // Insert a mixed match (2 humans + 1 bot) that v2 had previously counted as human_points
      raw
        .prepare(
          `INSERT INTO matches (
            id, room_code, ended_reason, winner_account_id, winner_name, winner_is_bot,
            seat_count, human_count, bot_count, timer_enabled, one_time_guess, duke_blocks_tax,
            card_theme, total_actions, total_challenges, total_blocks, started_at, finished_at
          ) VALUES (
            'm-old-mixed', 'CODE1', 'completed', 'acc-1', 'Raja Lama', 0,
            3, 2, 1, 0, 0, 0,
            'classic', 6, 1, 1, '2026-11-20T10:00:00Z', '2026-11-20T10:05:00Z'
          )`,
        )
        .run();
      raw
        .prepare(
          `INSERT INTO match_participants (
            id, match_id, seat_id, account_id, nickname, is_bot, is_winner, placement_rank, points_earned
          ) VALUES ('mp-1', 'm-old-mixed', 's1', 'acc-1', 'Raja Lama', 0, 1, 1, 3)`,
        )
        .run();
      raw
        .prepare(
          `INSERT INTO player_stats (
            account_id, matches_played, wins, losses, total_points,
            human_matches_played, human_wins, human_points, updated_at
          ) VALUES ('acc-1', 1, 1, 0, 3, 1, 1, 3, '2026-11-20T10:05:00Z')`,
        )
        .run();
      raw.close();

      // Open via createSqliteDatabase -> runs migration v3
      const upgraded = createSqliteDatabase(dbPath);
      expect(upgraded.schemaVersion).toBe(LATEST_SCHEMA_VERSION);

      // Mixed match must now be 0 in pure PvP stats, while totalPoints remains 3
      const st = upgraded.stats.getPlayerStats("acc-1")!;
      expect(st.totalPoints).toBe(3);
      expect(st.humanMatchesPlayed).toBe(0);
      expect(st.humanWins).toBe(0);
      expect(st.humanPoints).toBe(0);

      // Historical nickname must be backfilled
      const nicks = upgraded.nicknames.listForAccount("acc-1");
      expect(nicks).toHaveLength(1);
      expect(nicks[0].nickname).toBe("Raja Lama");
      expect(nicks[0].useCount).toBe(1);

      upgraded.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Stage A HTTP API, auth guard, privacy, and Socket.IO nickname tracking", () => {
  it("enforces login, prevents private data leaks, and records nicknames on create/join/rename", async () => {
    const db = createDatabase({ driver: "memory" });
    const auth = new AuthService({
      enabled: true,
      sessionSecret: "stage-a-test-secret-key-at-least-32-chars",
      db,
    });
    const fixedNow = () => new Date("2026-11-28T08:00:00.000Z");
    const api = new ApiService(auth, db, fixedNow);

    const accA = db.accounts.upsertGoogleProfile({
      sub: "g-a",
      email: "secret-alya@example.com",
      name: "Alya Putri",
      picture: "https://example.com/alya.png",
    });
    db.accounts.completeOnboarding(accA.id, "alya_p", "2026-11-20T00:00:00Z");

    const accB = db.accounts.upsertGoogleProfile({
      sub: "g-b",
      email: "secret-budi@example.com",
      name: "Budi Santoso",
    });
    db.accounts.completeOnboarding(accB.id, "budi_s", "2026-11-20T00:00:00Z");

    const accPending = db.accounts.upsertGoogleProfile({
      sub: "g-pending",
      email: "pending@example.com",
      name: "Belum Selesai",
    });

    db.stats.recordMatch(
      makeMatch({
        matchId: "m-api-1",
        roomCode: "PRIVATE999",
        winnerAccountId: accA.id,
        winnerName: "Ratu Alya",
        finishedAt: "2026-11-27T10:00:00.000Z",
        participants: [
          {
            seatId: "sa",
            accountId: accA.id,
            nickname: "Ratu Alya",
            isBot: false,
            isWinner: true,
            placementRank: 1,
            pointsEarned: 2,
            finalInfluence: 2,
            finalCoins: 5,
            peakCoins: 8,
            attacksMade: 2,
            timesTargeted: 1,
            challengesMade: 1,
            blocksMade: 1,
            bluffsMade: 1,
          },
          {
            seatId: "sb",
            accountId: accB.id,
            nickname: "Budi Jago",
            isBot: false,
            isWinner: false,
            placementRank: 2,
            pointsEarned: 0,
            finalInfluence: 0,
            finalCoins: 1,
            peakCoins: 4,
            attacksMade: 1,
            timesTargeted: 2,
            challengesMade: 0,
            blocksMade: 0,
            bluffsMade: 0,
          },
        ],
      }),
    );

    const server = createServer((req, res) => {
      void api.handleHttp(req, res).then((handled) => {
        if (!handled) {
          res.writeHead(404);
          res.end();
        }
      });
    });
    const { io, tables } = attach(server, 50, () => 0, auth, db.stats, db.nicknames);

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}`;
    const cookieA = `coup_session=${encodeURIComponent(auth.createSessionCookieValue(accA.id))}`;
    const cookieB = `coup_session=${encodeURIComponent(auth.createSessionCookieValue(accB.id))}`;
    const cookiePending = `coup_session=${encodeURIComponent(auth.createSessionCookieValue(accPending.id))}`;

    try {
      // 1. Unauthenticated blocked with 401
      expect((await fetch(`${base}/api/leaderboard`)).status).toBe(401);
      expect((await fetch(`${base}/api/me/profile`)).status).toBe(401);
      expect((await fetch(`${base}/api/players/alya_p`)).status).toBe(401);

      // 2. Non-onboarded blocked with 403
      expect(
        (
          await fetch(`${base}/api/leaderboard`, {
            headers: { cookie: cookiePending },
          })
        ).status,
      ).toBe(403);

      // 3. Socket create + join + rename records nickname suggestions automatically
      const sA = client(base, {
        extraHeaders: { cookie: cookieA },
        transports: ["websocket"],
      });
      const sB = client(base, {
        extraHeaders: { cookie: cookieB },
        transports: ["websocket"],
      });

      const created = await new Promise<{ ok: boolean; code?: string }>(
        (resolve) =>
          sA.emit("enter", { type: "create", name: "Ratu Alya" }, resolve),
      );
      expect(created.ok).toBe(true);

      const joined = await new Promise<{ ok: boolean }>((resolve) =>
        sB.emit(
          "enter",
          { type: "join", code: created.code, name: "Budi Jago" },
          resolve,
        ),
      );
      expect(joined.ok).toBe(true);

      const renamed = await new Promise<{ ok: boolean }>((resolve) =>
        sA.emit(
          "command",
          { revision: 2, command: { type: "rename", name: "Sang Ratu" } },
          resolve,
        ),
      );
      expect(renamed.ok).toBe(true);

      sA.disconnect();
      sB.disconnect();

      // 4. Verify /api/me/nicknames and DELETE
      const nickRes = await fetch(`${base}/api/me/nicknames`, {
        headers: { cookie: cookieA },
      });
      expect(nickRes.status).toBe(200);
      const nickJson = (await nickRes.json()) as {
        ok: boolean;
        lastUsed: string;
        suggestions: Array<{ nickname: string; nicknameKey: string }>;
      };
      expect(nickJson.lastUsed).toBe("Sang Ratu");
      expect(nickJson.suggestions.map((s) => s.nickname)).toContain("Ratu Alya");

      const delRes = await fetch(
        `${base}/api/me/nicknames/${encodeURIComponent("sang ratu")}`,
        { method: "DELETE", headers: { cookie: cookieA } },
      );
      expect(delRes.status).toBe(200);
      const delJson = (await delRes.json()) as { deleted: boolean; lastUsed: string };
      expect(delJson.deleted).toBe(true);
      expect(delJson.lastUsed).toBe("Ratu Alya");

      // 5. Public profile & match detail & leaderboard privacy checks
      const pubRes = await fetch(`${base}/api/players/alya_p`, {
        headers: { cookie: cookieB },
      });
      expect(pubRes.status).toBe(200);
      const pubText = await pubRes.text();
      expect(pubText).not.toContain("secret-alya@example.com");
      expect(pubText).not.toContain("g-a");
      expect(pubText).not.toContain("nicknames");

      const histRes = await fetch(
        `${base}/api/players/alya_p/matches?scope=pvp`,
        { headers: { cookie: cookieB } },
      );
      const histText = await histRes.text();
      expect(histRes.status).toBe(200);
      expect(histText).not.toContain("PRIVATE999");

      const detailRes = await fetch(`${base}/api/matches/m-api-1`, {
        headers: { cookie: cookieB },
      });
      const detailText = await detailRes.text();
      expect(detailRes.status).toBe(200);
      expect(detailText).not.toContain("PRIVATE999");
      expect(detailText).not.toContain("secret-alya@example.com");
      expect(detailText).not.toContain(accA.id);

      const lbRes = await fetch(`${base}/api/leaderboard`, {
        headers: { cookie: cookieB },
      });
      expect(lbRes.status).toBe(200);
      const lbJson = (await lbRes.json()) as {
        mode: string;
        period: string;
        entries: Array<{ username: string; points: number; isMe: boolean }>;
        myEntry: { username: string; rank: number };
      };
      expect(lbJson.mode).toBe("pvp");
      expect(lbJson.period).toBe("weekly");
      expect(lbJson.entries[0].username).toBe("alya_p");
      expect(lbJson.myEntry.username).toBe("budi_s");
      expect(lbJson.myEntry.rank).toBe(2);
    } finally {
      tables.dispose();
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
      db.close();
    }
  });
});
