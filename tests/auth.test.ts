import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { io as connect, type Socket } from "socket.io-client";
import { describe, expect, it } from "vitest";
import {
  AuthService,
  FileAccountStore,
  MemoryAccountStore,
  sanitizeReturnTo,
  validateUsername,
} from "../server/auth";
import { attach } from "../server/socket";

function cookieFromSetCookie(headers: string[] | string | undefined): string {
  const list = Array.isArray(headers) ? headers : headers ? [headers] : [];
  return list
    .map((c) => c.split(";")[0])
    .filter((pair) => !pair.endsWith("="))
    .join("; ");
}

describe("Google OAuth, unique username, and Socket.IO enforcement", () => {
  it("validates username rules and enforces case-insensitive uniqueness across restarts", () => {
    expect(validateUsername("  Fachry_99 ")).toBe("fachry_99");
    expect(() => validateUsername("ab")).toThrow();
    expect(() => validateUsername("bad name")).toThrow();
    expect(() => validateUsername("_leading")).toThrow();
    expect(() => validateUsername("double__under")).toThrow();
    expect(() => validateUsername("admin")).toThrow();

    expect(sanitizeReturnTo("/?room=ABCDEF1234")).toBe("/?room=ABCDEF1234");
    expect(sanitizeReturnTo("//evil.example")).toBe("/");
    expect(sanitizeReturnTo("https://evil.example")).toBe("/");

    const dir = mkdtempSync(join(tmpdir(), "coup-auth-"));
    try {
      const store1 = new FileAccountStore(dir);
      const u1 = store1.upsertGoogleProfile({
        sub: "sub-1",
        email: "Alpha@Example.com",
        name: "Alpha",
      });
      const u2 = store1.upsertGoogleProfile({
        sub: "sub-2",
        email: "Beta@Example.com",
        name: "Beta",
      });
      store1.completeOnboarding(u1.id, "Raja_Meja", "2026-11-27T00:00:00.000Z");
      expect(() =>
        store1.completeOnboarding(
          u2.id,
          "raja_meja",
          "2026-11-27T00:00:00.000Z",
        ),
      ).toThrow(/sudah dipakai/);

      // Persists across server restart
      const store2 = new FileAccountStore(dir);
      expect(store2.getBySub("sub-1")?.username).toBe("raja_meja");
      expect(() =>
        store2.completeOnboarding(
          u2.id,
          "RAJA_MEJA",
          "2026-11-27T00:00:00.000Z",
        ),
      ).toThrow(/sudah dipakai/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("completes Google OAuth PKCE, requires unique username & terms, and allows custom in-game nicknames", async () => {
    const store = new MemoryAccountStore();
    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url === "https://oauth2.googleapis.com/token") {
        return new Response(JSON.stringify({ access_token: "mock-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url === "https://openidconnect.googleapis.com/v1/userinfo") {
        return new Response(
          JSON.stringify({
            sub: "google-sub-guest",
            email: "guest@example.com",
            email_verified: true,
            name: "Guest Google Name",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    };

    const auth = new AuthService({
      enabled: true,
      googleClientId: "test-client-id",
      googleClientSecret: "test-client-secret",
      sessionSecret: "test-session-secret-32-bytes-long",
      store,
      fetchImpl: mockFetch,
    });

    const http = createServer((req, res) => {
      void auth.handleHttp(req, res).then((handled) => {
        if (!handled) {
          res.writeHead(404);
          res.end();
        }
      });
    });
    const { io, tables } = attach(http, undefined, () => 0, auth);
    await new Promise<void>((done) => http.listen(0, "127.0.0.1", done));
    const port = (http.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}`;
    const sockets: Socket[] = [];

    function tryConnect(cookie?: string): Promise<Socket> {
      return new Promise((resolve, reject) => {
        const s = connect(base, {
          transports: ["websocket"],
          forceNew: true,
          reconnection: false,
          extraHeaders: cookie ? { Cookie: cookie } : undefined,
        });
        sockets.push(s);
        s.once("connect", () => resolve(s));
        s.once("connect_error", (err) => reject(err));
      });
    }

    try {
      // 1. Engine.IO polling healthcheck (used by redeploy.sh) still succeeds
      const health = await fetch(
        `${base}/socket.io/?EIO=4&transport=polling`,
      );
      expect(health.status).toBe(200);
      expect((await health.text()).startsWith("0{")).toBe(true);

      // 2. Unauthenticated Socket.IO connection is rejected
      await expect(tryConnect()).rejects.toThrow("AUTH_REQUIRED");

      // 3. Google OAuth start sets PKCE state cookie & redirects to Google
      const startRes = await fetch(
        `${base}/api/auth/google?returnTo=${encodeURIComponent("/?room=ABCDEF1234")}`,
        { redirect: "manual" },
      );
      expect(startRes.status).toBe(302);
      const googleRedirect = new URL(startRes.headers.get("location")!);
      expect(googleRedirect.origin).toBe("https://accounts.google.com");
      expect(googleRedirect.searchParams.get("code_challenge_method")).toBe(
        "S256",
      );
      const state = googleRedirect.searchParams.get("state")!;
      const oauthCookie = cookieFromSetCookie(
        startRes.headers.getSetCookie(),
      );

      // 4. Callback verifies state, fetches Google profile, sets coup_session cookie
      const cbRes = await fetch(
        `${base}/api/auth/google/callback?code=mock-code&state=${encodeURIComponent(state)}`,
        {
          redirect: "manual",
          headers: { Cookie: oauthCookie },
        },
      );
      expect(cbRes.status).toBe(302);
      expect(cbRes.headers.get("location")).toBe("/?room=ABCDEF1234");
      const sessionCookie = cookieFromSetCookie(cbRes.headers.getSetCookie());
      expect(sessionCookie).toContain("coup_session=");

      // 5. Logged in via Google, but has not chosen unique username yet -> Socket.IO rejects ONBOARDING_REQUIRED
      const me1 = await (
        await fetch(`${base}/api/auth/me`, {
          headers: { Cookie: sessionCookie },
        })
      ).json();
      expect(me1.user.email).toBe("guest@example.com");
      await expect(tryConnect(sessionCookie)).rejects.toThrow(
        "ONBOARDING_REQUIRED",
      );

      // 6. Onboarding requires acceptTerms=true and unique username
      const noTerms = await fetch(`${base}/api/auth/onboarding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ username: "guest_01", acceptTerms: false }),
      });
      expect(noTerms.status).toBe(400);

      const onboarded = await fetch(`${base}/api/auth/onboarding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ username: "Guest_01", acceptTerms: true }),
      });
      expect(onboarded.status).toBe(200);
      const onboardedBody = await onboarded.json();
      expect(onboardedBody.user.username).toBe("guest_01");
      expect(onboardedBody.user.termsAcceptedAt).toBeTruthy();

      // 7. Socket.IO now succeeds AND player can use ANY custom nickname in-game!
      const sock = await tryConnect(sessionCookie);
      const entered = await sock.timeout(3000).emitWithAck("enter", {
        type: "create",
        name: "Bangsawan Misterius",
      });
      expect(entered.ok).toBe(true);
    } finally {
      for (const s of sockets) s.disconnect();
      tables.dispose();
      await io.close();
    }
  });

  it("persists fallback session secret across server restarts and sets Secure cookie only on HTTPS", async () => {
    const dir = mkdtempSync(join(tmpdir(), "coup-session-persist-"));
    const prevSecret = process.env.AUTH_SESSION_SECRET;
    delete process.env.AUTH_SESSION_SECRET;
    try {
      const auth1 = new AuthService({
        enabled: true,
        googleClientId: "cid",
        googleClientSecret: "csec",
        dataDir: dir,
      });
      const acc = auth1.getStore().upsertGoogleProfile({
        sub: "persist-sub-1",
        email: "persist@example.com",
        name: "Persist User",
      });
      const cookieValue = auth1.createSessionCookieValue(acc.id);
      const cookieHeader = `coup_session=${encodeURIComponent(cookieValue)}`;
      expect(auth1.authenticateCookieHeader(cookieHeader)?.id).toBe(acc.id);
      auth1.dispose();

      // Simulate full server restart with AUTH_SESSION_SECRET still unset
      const auth2 = new AuthService({
        enabled: true,
        googleClientId: "cid",
        googleClientSecret: "csec",
        dataDir: dir,
      });
      try {
        expect(auth2.authenticateCookieHeader(cookieHeader)?.id).toBe(acc.id);

        // Verify Set-Cookie attributes: no Secure on plain HTTP (even LAN IP), Secure on HTTPS proxy
        const http = createServer((req, res) => {
          void auth2.handleHttp(req, res).then((handled) => {
            if (!handled) {
              res.writeHead(404);
              res.end();
            }
          });
        });
        await new Promise<void>((done) => http.listen(0, "127.0.0.1", done));
        try {
          const port = (http.address() as AddressInfo).port;
          const plainRes = await fetch(
            `http://127.0.0.1:${port}/api/auth/google`,
            { redirect: "manual" },
          );
          const plainCookie = plainRes.headers.getSetCookie().join(";");
          expect(plainCookie).toContain("Max-Age=");
          expect(plainCookie).toContain("Expires=");
          expect(plainCookie).not.toContain("; Secure");

          const httpsRes = await fetch(
            `http://127.0.0.1:${port}/api/auth/google`,
            {
              redirect: "manual",
              headers: {
                "x-forwarded-proto": "https",
                "x-forwarded-host": "coup.jejakode.com",
              },
            },
          );
          const httpsCookie = httpsRes.headers.getSetCookie().join(";");
          expect(httpsCookie).toContain("; Secure");
        } finally {
          await new Promise<void>((done) => http.close(() => done()));
        }
      } finally {
        auth2.dispose();
      }
    } finally {
      if (prevSecret !== undefined) {
        process.env.AUTH_SESSION_SECRET = prevSecret;
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
