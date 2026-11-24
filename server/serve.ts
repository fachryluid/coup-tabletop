import next from "next";
import { createServer } from "node:http";
import { attach } from "./socket";
export async function serve(firstSeat?: (size: number) => number) {
  const dev = !process.argv.includes("--production");
  Object.assign(process.env, { NODE_ENV: dev ? "development" : "production" });
  const port = Number(process.env.PORT ?? 3000);
  const app = next({ dev, port });
  await app.prepare();
  const handle = app.getRequestHandler();
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
    void handle(req, res);
  });
  attach(http, undefined, firstSeat);
  http.listen(port, () =>
    console.log("Coup Tabletop berjalan pada port " + port),
  );
}
