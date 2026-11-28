import { serve } from "./serve";

const { http, db } = await serve();

let closing = false;
function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  console.log(`Menerima ${signal}, menutup server dan database dengan aman...`);
  http.close(() => {
    try {
      db.close();
    } catch {
      // Already closed via http close listener
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
