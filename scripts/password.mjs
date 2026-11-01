import { randomBytes, scryptSync } from "node:crypto";
const password = process.argv[2];
if (!password || password.length < 14) {
  console.error("Usage: npm run admin:password -- \"password-with-at-least-14-characters\"");
  process.exit(1);
}
const salt = randomBytes(16).toString("hex");
console.log(`${salt}:${scryptSync(password, salt, 64).toString("hex")}`);
