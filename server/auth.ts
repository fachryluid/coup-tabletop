import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { z } from "zod";
import {
  createDatabase,
  MemoryAccountStore,
  type AccountRecord,
  type AccountStore,
  type AppDatabase,
} from "./db";
import { normalizeUsername, validateUsername } from "./username";

export { MemoryAccountStore, normalizeUsername, validateUsername };
export type { AccountRecord, AccountStore };

export interface PublicAccount {
  id: string;
  email: string;
  name: string;
  picture?: string;
  username?: string;
  termsAcceptedAt?: string;
}

export interface AuthStatePayload {
  authRequired: boolean;
  user: PublicAccount | null;
}

export class FileAccountStore extends MemoryAccountStore {
  private readonly accountsFile: string;

  constructor(dataDir: string) {
    super();
    mkdirSync(dataDir, { recursive: true });
    this.accountsFile = join(dataDir, "accounts.json");
    this.loadAccounts();
  }

  private loadAccounts() {
    if (!existsSync(this.accountsFile)) return;
    try {
      const raw = readFileSync(this.accountsFile, "utf8");
      const parsed = JSON.parse(raw) as AccountRecord[];
      if (!Array.isArray(parsed)) return;
      for (const rec of parsed) {
        if (!rec?.id || !rec.googleSub || !rec.email) continue;
        this.byId.set(rec.id, rec);
        this.bySub.set(rec.googleSub, rec.id);
        if (rec.username) {
          this.byUsername.set(normalizeUsername(rec.username), rec.id);
        }
      }
    } catch (error) {
      console.error("Gagal membaca accounts.json:", error);
    }
  }

  protected override persist(): void {
    const tmp = this.accountsFile + "." + process.pid + ".tmp";
    const payload = JSON.stringify(Array.from(this.byId.values()), null, 2);
    writeFileSync(tmp, payload, "utf8");
    renameSync(tmp, this.accountsFile);
  }
}

export interface AuthConfig {
  enabled?: boolean;
  googleClientId?: string;
  googleClientSecret?: string;
  sessionSecret?: string;
  origin?: string;
  dataDir?: string;
  db?: AppDatabase;
  store?: AccountStore;
  fetchImpl?: typeof fetch;
}

const SESSION_COOKIE = "coup_session";
const OAUTH_COOKIE = "coup_oauth";
const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30 days
const OAUTH_TTL_SEC = 60 * 10; // 10 minutes

const onboardingBody = z
  .object({
    username: z.string().max(40),
    acceptTerms: z.boolean(),
  })
  .strict();

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

export function sanitizeReturnTo(raw?: string | null): string {
  if (!raw) return "/";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";
  if (trimmed.includes("\r") || trimmed.includes("\n")) return "/";
  return trimmed;
}

function readJsonBody(req: IncomingMessage, maxBytes = 8192): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Error("Ukuran permintaan terlalu besar."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? JSON.parse(text) : {});
      } catch {
        reject(Error("Format JSON tidak sah."));
      }
    });
    req.on("error", () => reject(Error("Gagal membaca permintaan.")));
  });
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: object,
  extraHeaders?: Record<string, string | string[]>,
) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

function sendRedirect(
  res: ServerResponse,
  location: string,
  cookies?: string[],
) {
  res.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store",
    ...(cookies?.length ? { "Set-Cookie": cookies } : {}),
  });
  res.end();
}

export class AuthService {
  private readonly store: AccountStore;
  private readonly ownedDb?: AppDatabase;
  private readonly fallbackSecret: string;
  private readonly overrides: AuthConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: AuthConfig = {}) {
    this.overrides = config;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.fallbackSecret = this.loadOrCreateFallbackSecret(config);
    if (config.store) {
      this.store = config.store;
    } else if (config.db) {
      this.store = config.db.accounts;
    } else {
      const db = createDatabase({ dataDir: config.dataDir });
      this.ownedDb = db;
      this.store = db.accounts;
    }
  }

  private loadOrCreateFallbackSecret(config: AuthConfig): string {
    // Pure in-memory unit tests without a dataDir should not touch disk.
    if (config.store && !config.dataDir) {
      return randomBytes(32).toString("hex");
    }
    if (config.db?.driver === "memory" && !config.dataDir) {
      return randomBytes(32).toString("hex");
    }
    const dir =
      config.dataDir ??
      process.env.COUP_DATA_DIR?.trim() ??
      join(process.cwd(), "data");
    const secretFile = join(dir, ".session-secret");
    try {
      mkdirSync(dir, { recursive: true });
      if (existsSync(secretFile)) {
        const saved = readFileSync(secretFile, "utf8").trim();
        if (saved.length >= 32) return saved;
      }
      const generated = randomBytes(32).toString("hex");
      const tmp = secretFile + "." + process.pid + ".tmp";
      writeFileSync(tmp, generated + "\n", { encoding: "utf8", mode: 0o600 });
      renameSync(tmp, secretFile);
      return generated;
    } catch {
      return randomBytes(32).toString("hex");
    }
  }

  dispose() {
    this.ownedDb?.close();
  }

  getStore(): AccountStore {
    return this.store;
  }

  private googleClientId(): string {
    return (
      this.overrides.googleClientId ?? process.env.GOOGLE_CLIENT_ID ?? ""
    ).trim();
  }

  private googleClientSecret(): string {
    return (
      this.overrides.googleClientSecret ??
      process.env.GOOGLE_CLIENT_SECRET ??
      ""
    ).trim();
  }

  private sessionSecret(): string {
    const secret = (
      this.overrides.sessionSecret ??
      process.env.AUTH_SESSION_SECRET ??
      ""
    ).trim();
    if (secret) return secret;
    return this.fallbackSecret;
  }

  isEnabled(): boolean {
    if (this.overrides.enabled !== undefined) return this.overrides.enabled;
    const raw = process.env.AUTH_REQUIRED?.trim().toLowerCase();
    if (raw === "true" || raw === "1") return true;
    if (raw === "false" || raw === "0") return false;
    return Boolean(this.googleClientId());
  }

  isReadyToPlay(account: AccountRecord): boolean {
    return Boolean(account.username) && Boolean(account.termsAcceptedAt);
  }

  toPublic(account: AccountRecord): PublicAccount {
    return {
      id: account.id,
      email: account.email,
      name: account.name,
      picture: account.picture,
      username: account.username,
      termsAcceptedAt: account.termsAcceptedAt,
    };
  }

  signToken(payload: object): string {
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64url",
    );
    const sig = createHmac("sha256", this.sessionSecret())
      .update(encoded)
      .digest("base64url");
    return encoded + "." + sig;
  }

  verifyToken<T>(token?: string): T | null {
    if (!token) return null;
    const dot = token.indexOf(".");
    if (dot <= 0) return null;
    const encoded = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = createHmac("sha256", this.sessionSecret())
      .update(encoded)
      .digest("base64url");
    if (!safeEqual(sig, expected)) return null;
    try {
      return JSON.parse(
        Buffer.from(encoded, "base64url").toString("utf8"),
      ) as T;
    } catch {
      return null;
    }
  }

  createSessionCookieValue(accountId: string, now = Date.now()): string {
    return this.signToken({
      uid: accountId,
      exp: now + SESSION_TTL_SEC * 1000,
    });
  }

  authenticateCookieHeader(cookieHeader?: string): AccountRecord | null {
    const cookies = parseCookies(cookieHeader);
    const parsed = this.verifyToken<{ uid: string; exp: number }>(
      cookies[SESSION_COOKIE],
    );
    if (!parsed || typeof parsed.uid !== "string" || parsed.exp < Date.now()) {
      return null;
    }
    return this.store.getById(parsed.uid) ?? null;
  }

  stateFor(cookieHeader?: string): AuthStatePayload {
    const account = this.authenticateCookieHeader(cookieHeader);
    return {
      authRequired: this.isEnabled(),
      user: account ? this.toPublic(account) : null,
    };
  }

  private resolveOrigin(req: IncomingMessage): string {
    const protoHeader = String(req.headers["x-forwarded-proto"] ?? "")
      .split(",")[0]
      ?.trim()
      .toLowerCase();
    const host = String(
      req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:3000",
    )
      .split(",")[0]
      ?.trim();
    const isLocalHost =
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1") ||
      host.startsWith("[::1]");

    if (this.overrides.origin?.trim()) {
      return this.overrides.origin.trim().replace(/\/+$/, "");
    }
    const envOrigin = (process.env.COUP_ORIGIN ?? "").trim().replace(/\/+$/, "");
    // Avoid overriding local dev/preview requests (http://localhost) with production COUP_ORIGIN.
    if (envOrigin && !isLocalHost) return envOrigin;

    const encrypted = Boolean(
      (req.socket as { encrypted?: boolean } | undefined)?.encrypted,
    );
    const proto = protoHeader || (encrypted ? "https" : "http");
    return `${proto}://${host}`;
  }

  private isSecureRequest(req: IncomingMessage): boolean {
    const protoHeader = String(req.headers["x-forwarded-proto"] ?? "")
      .split(",")[0]
      ?.trim()
      .toLowerCase();
    if (protoHeader) return protoHeader === "https";
    const encrypted = Boolean(
      (req.socket as { encrypted?: boolean } | undefined)?.encrypted,
    );
    return encrypted;
  }

  private formatCookie(
    name: string,
    value: string,
    maxAge: number,
    secure: boolean,
  ): string {
    const expires = new Date(
      maxAge <= 0 ? 0 : Date.now() + maxAge * 1000,
    ).toUTCString();
    const parts = [
      `${name}=${encodeURIComponent(value)}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${maxAge}`,
      `Expires=${expires}`,
    ];
    if (secure) parts.push("Secure");
    return parts.join("; ");
  }

  async handleHttp(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const pathname = url.pathname;
    if (!pathname.startsWith("/api/auth/")) return false;

    const method = (req.method ?? "GET").toUpperCase();
    const secure = this.isSecureRequest(req);

    if (pathname === "/api/auth/me" && method === "GET") {
      sendJson(res, 200, this.stateFor(req.headers.cookie));
      return true;
    }

    if (pathname === "/api/auth/logout" && method === "POST") {
      sendJson(
        res,
        200,
        { ok: true },
        {
          "Set-Cookie": [
            this.formatCookie(SESSION_COOKIE, "", 0, secure),
            this.formatCookie(OAUTH_COOKIE, "", 0, secure),
          ],
        },
      );
      return true;
    }

    if (pathname === "/api/auth/google" && method === "GET") {
      const clientId = this.googleClientId();
      const clientSecret = this.googleClientSecret();
      if (!clientId || !clientSecret) {
        sendRedirect(
          res,
          "/?authError=" + encodeURIComponent("oauth_not_configured"),
        );
        return true;
      }
      const state = randomBytes(24).toString("hex");
      const verifier = randomBytes(32).toString("base64url");
      const challenge = createHash("sha256")
        .update(verifier)
        .digest("base64url");
      const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));
      const origin = this.resolveOrigin(req);
      const redirectUri = `${origin}/api/auth/google/callback`;

      const googleUrl = new URL(
        "https://accounts.google.com/o/oauth2/v2/auth",
      );
      googleUrl.searchParams.set("client_id", clientId);
      googleUrl.searchParams.set("redirect_uri", redirectUri);
      googleUrl.searchParams.set("response_type", "code");
      googleUrl.searchParams.set("scope", "openid email profile");
      googleUrl.searchParams.set("state", state);
      googleUrl.searchParams.set("code_challenge", challenge);
      googleUrl.searchParams.set("code_challenge_method", "S256");
      googleUrl.searchParams.set("prompt", "select_account");

      const oauthCookie = this.formatCookie(
        OAUTH_COOKIE,
        this.signToken({
          state,
          verifier,
          returnTo,
          exp: Date.now() + OAUTH_TTL_SEC * 1000,
        }),
        OAUTH_TTL_SEC,
        secure,
      );
      sendRedirect(res, googleUrl.toString(), [oauthCookie]);
      return true;
    }

    if (pathname === "/api/auth/google/callback" && method === "GET") {
      const clearOauth = this.formatCookie(OAUTH_COOKIE, "", 0, secure);
      const oauthError = url.searchParams.get("error");
      if (oauthError) {
        sendRedirect(
          res,
          "/?authError=" + encodeURIComponent("google_cancelled"),
          [clearOauth],
        );
        return true;
      }
      const codeParam = url.searchParams.get("code");
      const stateParam = url.searchParams.get("state");
      const cookies = parseCookies(req.headers.cookie);
      const saved = this.verifyToken<{
        state: string;
        verifier: string;
        returnTo: string;
        exp: number;
      }>(cookies[OAUTH_COOKIE]);

      if (
        !codeParam ||
        !stateParam ||
        !saved ||
        saved.exp < Date.now() ||
        !safeEqual(stateParam, saved.state)
      ) {
        sendRedirect(
          res,
          "/?authError=" + encodeURIComponent("invalid_state"),
          [clearOauth],
        );
        return true;
      }

      const clientId = this.googleClientId();
      const clientSecret = this.googleClientSecret();
      const origin = this.resolveOrigin(req);
      const redirectUri = `${origin}/api/auth/google/callback`;

      try {
        const tokenRes = await this.fetchImpl(
          "https://oauth2.googleapis.com/token",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code: codeParam,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: redirectUri,
              grant_type: "authorization_code",
              code_verifier: saved.verifier,
            }),
          },
        );
        if (!tokenRes.ok) {
          sendRedirect(
            res,
            "/?authError=" + encodeURIComponent("token_exchange_failed"),
            [clearOauth],
          );
          return true;
        }
        const tokenData = (await tokenRes.json()) as {
          access_token?: string;
        };
        if (!tokenData.access_token) {
          sendRedirect(
            res,
            "/?authError=" + encodeURIComponent("token_exchange_failed"),
            [clearOauth],
          );
          return true;
        }

        const userRes = await this.fetchImpl(
          "https://openidconnect.googleapis.com/v1/userinfo",
          {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
            },
          },
        );
        if (!userRes.ok) {
          sendRedirect(
            res,
            "/?authError=" + encodeURIComponent("userinfo_failed"),
            [clearOauth],
          );
          return true;
        }
        const profile = (await userRes.json()) as {
          sub?: string;
          email?: string;
          email_verified?: boolean;
          name?: string;
          picture?: string;
        };
        if (!profile.sub || !profile.email || profile.email_verified !== true) {
          sendRedirect(
            res,
            "/?authError=" + encodeURIComponent("email_unverified"),
            [clearOauth],
          );
          return true;
        }

        const account = this.store.upsertGoogleProfile({
          sub: profile.sub,
          email: profile.email,
          name: profile.name ?? profile.email.split("@")[0] ?? "Pemain",
          picture: profile.picture,
        });
        const sessionCookie = this.formatCookie(
          SESSION_COOKIE,
          this.createSessionCookieValue(account.id),
          SESSION_TTL_SEC,
          secure,
        );
        sendRedirect(res, sanitizeReturnTo(saved.returnTo), [
          clearOauth,
          sessionCookie,
        ]);
        return true;
      } catch (error) {
        console.error("Google OAuth callback error:", error);
        sendRedirect(
          res,
          "/?authError=" + encodeURIComponent("oauth_failed"),
          [clearOauth],
        );
        return true;
      }
    }

    if (pathname === "/api/auth/onboarding" && method === "POST") {
      const account = this.authenticateCookieHeader(req.headers.cookie);
      if (!account) {
        sendJson(res, 401, {
          ok: false,
          error: "Silakan masuk dengan Google terlebih dahulu.",
        });
        return true;
      }
      try {
        const parsed = onboardingBody.parse(await readJsonBody(req));
        if (!parsed.acceptTerms) {
          sendJson(res, 400, {
            ok: false,
            error: "Anda harus menyetujui Syarat & Ketentuan terlebih dahulu.",
          });
          return true;
        }
        this.store.completeOnboarding(
          account.id,
          parsed.username,
          new Date().toISOString(),
        );
        sendJson(res, 200, {
          ok: true,
          ...this.stateFor(req.headers.cookie),
        });
      } catch (error) {
        const message =
          error instanceof z.ZodError
            ? "Format data akun tidak sah."
            : error instanceof Error
              ? error.message
              : "Gagal menyimpan username.";
        const status = message.includes("sudah dipakai") ? 409 : 400;
        sendJson(res, status, { ok: false, error: message });
      }
      return true;
    }

    sendJson(res, 404, {
      ok: false,
      error: "Endpoint autentikasi tidak ditemukan.",
    });
    return true;
  }
}
