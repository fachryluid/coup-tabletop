import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDatabase,
  createSqliteDatabase,
  LATEST_SCHEMA_VERSION,
  type RecordMatchInput,
} from "../server/db";
import { MemoryRooms, Tables } from "../server/rooms";
import { phaseStamp } from "../domain/model";

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), "coup-db-"));
}

describe("SQLite database foundation, migrations, stats, and global leaderboard", () => {
  it("runs versioned migrations idempotently and auto-imports legacy accounts.json", () => {
    const dir = makeTempDir();
    try {
      const legacyFile = join(dir, "accounts.json");
      writeFileSync(
        legacyFile,
        JSON.stringify([
          {
            id: "acc-legacy-1",
            googleSub: "sub-legacy-1",
            email: "Legacy@Example.com",
            name: "Legacy Player",
            username: "Legacy_User",
            termsAcceptedAt: "2026-11-20T00:00:00.000Z",
            createdAt: "2026-11-20T00:00:00.000Z",
            updatedAt: "2026-11-20T00:00:00.000Z",
          },
        ]),
        "utf8",
      );

      const dbPath = join(dir, "coup.db");
      const db1 = createSqliteDatabase(dbPath, {
        legacyAccountsFile: legacyFile,
      });
      expect(db1.driver).toBe("sqlite");
      expect(db1.schemaVersion).toBe(LATEST_SCHEMA_VERSION);

      const imported = db1.accounts.getBySub("sub-legacy-1");
      expect(imported?.id).toBe("acc-legacy-1");
      expect(imported?.email).toBe("legacy@example.com");
      expect(imported?.username).toBe("legacy_user");

      const created = db1.accounts.upsertGoogleProfile({
        sub: "sub-new-2",
        email: "New@Example.com",
        name: "New Player",
        picture: "https://example.com/pic.png",
      });
      expect(() =>
        db1.accounts.completeOnboarding(
          created.id,
          "LEGACY_USER",
          "2026-11-27T00:00:00.000Z",
        ),
      ).toThrow(/sudah dipakai/);

      db1.accounts.completeOnboarding(
        created.id,
        "new_player",
        "2026-11-27T00:00:00.000Z",
      );
      db1.close();

      // Reopen same SQLite file: migrations are idempotent and accounts persist
      const db2 = createSqliteDatabase(dbPath, {
        legacyAccountsFile: legacyFile,
      });
      expect(db2.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
      expect(db2.accounts.getByUsername("new_player")?.picture).toBe(
        "https://example.com/pic.png",
      );
      expect(db2.accounts.listAll?.().length).toBe(2);
      db2.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("atomically records matches, updates player stats & streaks, ranks global leaderboard (all & pvp), and exports snapshots", () => {
    const dir = makeTempDir();
    try {
      const db = createDatabase({ driver: "sqlite", dataDir: dir });

      const a = db.accounts.upsertGoogleProfile({
        sub: "sub-a",
        email: "alpha@example.com",
        name: "Alpha",
        picture: "https://example.com/a.png",
      });
      db.accounts.completeOnboarding(a.id, "alpha_01", "2026-11-27T00:00:00Z");

      const b = db.accounts.upsertGoogleProfile({
        sub: "sub-b",
        email: "beta@example.com",
        name: "Beta",
      });
      db.accounts.completeOnboarding(b.id, "beta_02", "2026-11-27T00:00:00Z");

      // Match 1: PvP (Alpha beats Beta)
      const match1: RecordMatchInput = {
        matchId: "m-1",
        roomCode: "AABBCCDDEE",
        endedReason: "completed",
        winnerAccountId: a.id,
        winnerName: "AlphaNick",
        winnerIsBot: false,
        seatCount: 2,
        humanCount: 2,
        botCount: 0,
        timerEnabled: false,
        oneTimeGuess: true,
        dukeBlocksTax: false,
        cardTheme: "classic",
        totalActions: 8,
        totalChallenges: 2,
        totalBlocks: 1,
        startedAt: "2026-11-27T10:00:00.000Z",
        finishedAt: "2026-11-27T10:05:00.000Z",
        participants: [
          {
            seatId: "s-a",
            accountId: a.id,
            nickname: "AlphaNick",
            isBot: false,
            isWinner: true,
            placementRank: 1,
            pointsEarned: 2,
            finalInfluence: 2,
            finalCoins: 5,
            peakCoins: 9,
            attacksMade: 2,
            timesTargeted: 1,
            challengesMade: 1,
            blocksMade: 1,
            bluffsMade: 2,
          },
          {
            seatId: "s-b",
            accountId: b.id,
            nickname: "BetaNick",
            isBot: false,
            isWinner: false,
            placementRank: 2,
            pointsEarned: 0,
            finalInfluence: 0,
            finalCoins: 1,
            peakCoins: 4,
            attacksMade: 1,
            timesTargeted: 2,
            challengesMade: 1,
            blocksMade: 0,
            bluffsMade: 1,
          },
        ],
      };

      expect(db.stats.recordMatch(match1)).toBe(true);
      // Duplicate call with same matchId must be idempotent
      expect(db.stats.recordMatch(match1)).toBe(false);

      // Match 2: Solo vs Bot (Beta beats Computer 1 -> counts in "all", NOT in "pvp")
      expect(
        db.stats.recordMatch({
          matchId: "m-2",
          roomCode: "1122334455",
          endedReason: "completed",
          winnerAccountId: b.id,
          winnerName: "BetaSolo",
          winnerIsBot: false,
          seatCount: 2,
          humanCount: 1,
          botCount: 1,
          timerEnabled: true,
          oneTimeGuess: false,
          dukeBlocksTax: true,
          cardTheme: "custom1",
          totalActions: 6,
          totalChallenges: 1,
          totalBlocks: 1,
          startedAt: "2026-11-27T11:00:00.000Z",
          finishedAt: "2026-11-27T11:04:00.000Z",
          participants: [
            {
              seatId: "s-b2",
              accountId: b.id,
              nickname: "BetaSolo",
              isBot: false,
              isWinner: true,
              placementRank: 1,
              pointsEarned: 2,
              finalInfluence: 1,
              finalCoins: 3,
              peakCoins: 7,
              attacksMade: 2,
              timesTargeted: 1,
              challengesMade: 1,
              blocksMade: 1,
              bluffsMade: 0,
            },
            {
              seatId: "s-bot",
              nickname: "Computer 1",
              isBot: true,
              botDifficulty: "hard",
              isWinner: false,
              finalInfluence: 0,
              finalCoins: 2,
              peakCoins: 5,
              attacksMade: 1,
              timesTargeted: 2,
              challengesMade: 0,
              blocksMade: 0,
              bluffsMade: 1,
            },
          ],
        }),
      ).toBe(true);

      // Match 3: Host ended without winner -> saved in match history, does NOT alter wins/losses
      expect(
        db.stats.recordMatch({
          matchId: "m-3",
          roomCode: "AABBCCDDEE",
          endedReason: "host_ended",
          winnerIsBot: false,
          seatCount: 2,
          humanCount: 2,
          botCount: 0,
          timerEnabled: false,
          oneTimeGuess: false,
          dukeBlocksTax: false,
          cardTheme: "classic",
          totalActions: 1,
          totalChallenges: 0,
          totalBlocks: 0,
          startedAt: "2026-11-27T12:00:00.000Z",
          finishedAt: "2026-11-27T12:01:00.000Z",
          participants: [
            {
              seatId: "s-a3",
              accountId: a.id,
              nickname: "AlphaNick",
              isBot: false,
              isWinner: false,
              finalInfluence: 2,
              finalCoins: 2,
              peakCoins: 2,
              attacksMade: 0,
              timesTargeted: 0,
              challengesMade: 0,
              blocksMade: 0,
              bluffsMade: 0,
            },
            {
              seatId: "s-b3",
              accountId: b.id,
              nickname: "BetaNick",
              isBot: false,
              isWinner: false,
              finalInfluence: 2,
              finalCoins: 2,
              peakCoins: 2,
              attacksMade: 0,
              timesTargeted: 0,
              challengesMade: 0,
              blocksMade: 0,
              bluffsMade: 0,
            },
          ],
        }),
      ).toBe(true);

      const statsA = db.stats.getPlayerStats(a.id)!;
      expect(statsA.matchesPlayed).toBe(1);
      expect(statsA.wins).toBe(1);
      expect(statsA.totalPoints).toBe(2);
      expect(statsA.humanPoints).toBe(2);
      expect(statsA.winRate).toBe(100);
      expect(statsA.currentStreak).toBe(1);
      expect(statsA.bestStreak).toBe(1);
      expect(statsA.highestCoins).toBe(9);
      expect(statsA.totalBluffs).toBe(2);

      const statsB = db.stats.getPlayerStats(b.id)!;
      expect(statsB.matchesPlayed).toBe(2);
      expect(statsB.wins).toBe(1);
      expect(statsB.losses).toBe(1);
      expect(statsB.totalPoints).toBe(2);
      expect(statsB.winRate).toBe(50);
      expect(statsB.humanMatchesPlayed).toBe(1);
      expect(statsB.humanWins).toBe(0);
      expect(statsB.humanPoints).toBe(0);
      expect(statsB.humanWinRate).toBe(0);
      expect(statsB.currentStreak).toBe(1);
      expect(statsB.highestCoins).toBe(7);

      // All-mode leaderboard: both have 2 points and 1 win, Alpha has 100% winRate > Beta 50%
      const allBoard = db.stats.getGlobalLeaderboard({ mode: "all" });
      expect(allBoard).toHaveLength(2);
      expect(allBoard[0].username).toBe("alpha_01");
      expect(allBoard[0].points).toBe(2);
      expect(allBoard[0].rank).toBe(1);
      expect(allBoard[1].username).toBe("beta_02");
      expect(allBoard[1].points).toBe(2);
      expect(allBoard[1].rank).toBe(2);
      // Privacy check: leaderboard never exposes email or googleSub
      expect("email" in allBoard[0]).toBe(false);
      expect("googleSub" in allBoard[0]).toBe(false);

      // PvP-mode leaderboard: Alpha 2 points (1 win), Beta 0 points (0 wins)
      const pvpBoard = db.stats.getGlobalLeaderboard({ mode: "pvp" });
      expect(pvpBoard[0].username).toBe("alpha_01");
      expect(pvpBoard[0].points).toBe(2);
      expect(pvpBoard[0].wins).toBe(1);
      expect(pvpBoard[1].username).toBe("beta_02");
      expect(pvpBoard[1].points).toBe(0);
      expect(pvpBoard[1].wins).toBe(0);

      // Recent matches ordered newest-first
      const recentB = db.stats.getRecentMatches(b.id);
      expect(recentB.map((m) => m.matchId)).toEqual(["m-3", "m-2", "m-1"]);

      // Export snapshot ready for future DB migration
      const snap = db.exportSnapshot();
      expect(snap.accounts).toHaveLength(2);
      expect(snap.matches).toHaveLength(3);
      expect(snap.participants).toHaveLength(6);
      expect(snap.playerStats).toHaveLength(2);

      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("integrates with Tables to persist completed matches automatically without leaking accountId in RoomView", () => {
    const dir = makeTempDir();
    try {
      const db = createDatabase({ driver: "sqlite", dataDir: dir });
      const accA = db.accounts.upsertGoogleProfile({
        sub: "sub-room-a",
        email: "rooma@example.com",
        name: "Room A",
      });
      db.accounts.completeOnboarding(accA.id, "room_a", "2026-11-27T00:00:00Z");
      const accB = db.accounts.upsertGoogleProfile({
        sub: "sub-room-b",
        email: "roomb@example.com",
        name: "Room B",
      });
      db.accounts.completeOnboarding(accB.id, "room_b", "2026-11-27T00:00:00Z");

      const tables = new Tables(
        new MemoryRooms(),
        () => {},
        5000,
        () => 0,
        () => 0,
        (rec) => db.stats.recordMatch(rec),
      );

      const host = tables.create("Ayu", {}, accA.id);
      const guest = tables.admit(host.room, "Bima", undefined, accB.id);

      // Verify accountId is NOT leaked in public RoomView
      const view = tables.view(host.room, host.id);
      expect(JSON.stringify(view)).not.toContain(accA.id);
      expect(JSON.stringify(view)).not.toContain(accB.id);

      // Start match & give Ayu 14 coins so she eliminates Bima in 2 Coups
      const exec = (
        seatId: string,
        cmd: Parameters<Tables["execute"]>[3],
      ) => {
        const g = host.room.game;
        tables.execute(
          host.room,
          seatId,
          host.room.revision,
          cmd,
          g ? phaseStamp(g) : undefined,
        );
      };

      exec(host.id, { type: "start" });
      exec(host.id, {
        type: "coins",
        id: host.id,
        value: 14,
        reason: "Test finish",
      });
      exec(host.id, {
        type: "play",
        move: { kind: "Coup", target: guest.id, slot: 0 },
      });
      exec(guest.id, { type: "play", move: { kind: "Income" } });
      exec(host.id, {
        type: "play",
        move: { kind: "Coup", target: guest.id, slot: 0 },
      });

      expect(host.room.game?.stage).toBe("over");
      expect(host.room.game?.winner).toBe(host.id);

      const statsA = db.stats.getPlayerStats(accA.id)!;
      const statsB = db.stats.getPlayerStats(accB.id)!;
      expect(statsA.wins).toBe(1);
      expect(statsA.totalPoints).toBe(2);
      expect(statsA.humanPoints).toBe(2);
      expect(statsA.totalAttacks).toBe(2);
      expect(statsA.highestCoins).toBe(14);
      expect(statsB.losses).toBe(1);
      expect(statsB.totalPoints).toBe(0);
      expect(statsB.totalTargeted).toBe(2);

      const board = db.stats.getGlobalLeaderboard({ mode: "pvp" });
      expect(board[0].username).toBe("room_a");
      expect(board[0].points).toBe(2);
      expect(board[0].wins).toBe(1);

      tables.dispose();
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
