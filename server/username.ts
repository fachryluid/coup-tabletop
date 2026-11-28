const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "bentara",
  "bot",
  "computer",
  "coup",
  "host",
  "jejakode",
  "moderator",
  "root",
  "server",
  "staff",
  "support",
  "system",
]);

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): string {
  const username = normalizeUsername(raw);
  if (!USERNAME_RE.test(username)) {
    throw Error(
      "Username harus 3–20 karakter (huruf kecil a–z, angka 0–9, atau underscore _).",
    );
  }
  if (
    username.startsWith("_") ||
    username.endsWith("_") ||
    username.includes("__")
  ) {
    throw Error(
      "Username tidak boleh diawali/diakhiri underscore atau memakai __ berurutan.",
    );
  }
  if (RESERVED_USERNAMES.has(username)) {
    throw Error("Username tersebut tidak tersedia. Pilih username lain.");
  }
  return username;
}
