import next from "next";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ApiService } from "./api";
import { AuthService, type AuthConfig } from "./auth";
import { createDatabase } from "./db";
import type { Tables } from "./rooms";
import { attach } from "./socket";

function readSmallJson(req: IncomingMessage, maxBytes = 2048): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Error("too_large"));
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
        reject(Error("invalid_json"));
      }
    });
    req.on("error", () => reject(Error("read_error")));
  });
}

async function handleRoomCheck(
  req: IncomingMessage,
  res: ServerResponse,
  auth: AuthService,
  tables: Tables,
) {
  const send = (active: boolean) => {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify({ active }));
  };
  if (auth.isEnabled()) {
    const account = auth.authenticateCookieHeader(req.headers.cookie);
    if (!account || !auth.isReadyToPlay(account)) {
      send(false);
      return;
    }
  }
  try {
    const body = (await readSmallJson(req)) as {
      code?: unknown;
      token?: unknown;
    };
    const code = typeof body?.code === "string" ? body.code : "";
    const token = typeof body?.token === "string" ? body.token : "";
    send(tables.hasSession(code, token));
  } catch {
    send(false);
  }
}

export async function serve(
  firstSeat?: (size: number) => number,
  authConfig?: AuthConfig,
) {
  const dev = !process.argv.includes("--production");
  Object.assign(process.env, { NODE_ENV: dev ? "development" : "production" });
  const port = Number(process.env.PORT ?? 3000);
  const app = next({ dev, port });
  await app.prepare();
  const db = authConfig?.db ?? createDatabase({ dataDir: authConfig?.dataDir });
  const auth = new AuthService({ ...authConfig, db });
  const api = new ApiService(auth, db);
  const handle = app.getRequestHandler();
  let tablesRef: Tables | null = null;
  const http = createServer((req, res) => {
    if (
      (req.method === "GET" || req.method === "HEAD") &&
      req.url === "/healthz"
    ) {
      res.writeHead(200, {
        "Content-Type": "text/plain",
        "Cache-Control": "no-store",
      });
      res.end("ok");
      return;
    }
    if (req.method === "POST" && req.url?.split("?")[0] === "/api/room/check") {
      if (!tablesRef) {
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify({ active: false }));
        return;
      }
      void handleRoomCheck(req, res, auth, tablesRef);
      return;
    }
    void auth
      .handleHttp(req, res)
      .then((handled) => (handled ? true : api.handleHttp(req, res)))
      .then((handled) => {
        if (!handled) return handle(req, res);
      })
      .catch((error) => {
        console.error("Unhandled HTTP error:", error);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Internal Server Error");
        }
      });
  });
  const { tables } = attach(
    http,
    undefined,
    firstSeat,
    auth,
    db.stats,
    db.nicknames,
  );
  tablesRef = tables;
  const cleanup = () => {
    if (!authConfig?.db) db.close();
  };
  http.once("close", cleanup);
  http.listen(port, () =>
    console.log(
      `The Ultimate Coup berjalan pada port ${port} (db: ${db.driver}, schema v${db.schemaVersion})`,
    ),
  );
  return { http, auth, db };
}
