import { writeFileSync } from "node:fs";
import { createDatabase } from "./index";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outFile = outIdx >= 0 ? args[outIdx + 1] : undefined;

const db = createDatabase();
try {
  const snapshot = db.exportSnapshot();
  const payload = JSON.stringify(snapshot, null, 2);
  if (outFile) {
    writeFileSync(outFile, payload, "utf8");
    console.log(
      `Berhasil mengekspor database (${snapshot.accounts.length} akun, ${snapshot.matches.length} match) ke ${outFile}`,
    );
  } else {
    process.stdout.write(payload + "\n");
  }
} finally {
  db.close();
}
