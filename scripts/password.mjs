import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
if (process.argv[2] === "--stdin" && process.stdin.isTTY) {
  console.error("Pipe a password from a secure input prompt; do not type it into an unmasked terminal.");
  process.exit(1);
}
const password = process.argv[2] === "--stdin" ? readFileSync(0, "utf8").replace(/\r?\n$/, "") : process.argv[2];
if (!password || password.length < 14) {
  console.error("Usage: pipe a password with at least 14 characters to npm run admin:password -- --stdin");
  process.exit(1);
}
const salt = randomBytes(16).toString("hex");
console.log(`${salt}:${scryptSync(password, salt, 64).toString("hex")}`);
