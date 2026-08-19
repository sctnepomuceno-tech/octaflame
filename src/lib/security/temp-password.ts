import { randomBytes } from "crypto";

// Excludes visually ambiguous characters (0/O, 1/l/I) since this is meant
// to be read off a screen and typed or copy-pasted once, not memorized.
const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function generateTempPassword(length = 12): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join("");
}
