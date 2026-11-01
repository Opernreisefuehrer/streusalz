import "server-only";
import { createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { signToken, verifyToken } from "./tokens";
import { database } from "./db";
import { AppError } from "./errors";

const sessionSchema = z.object({ email: z.string(), fingerprint: z.string() });
export const SESSION_COOKIE = "streusalz-admin";
function fingerprint() {
  return createHash("sha256").update(process.env.ADMIN_PASSWORD_HASH || "").digest("hex");
}
export async function requireAdmin() {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) throw new AppError("Bitte im Adminbereich anmelden.", 401);
  const session = verifyToken(cookie, "admin", sessionSchema);
  if (session.email !== process.env.ADMIN_EMAIL || session.fingerprint !== fingerprint()) throw new AppError("Die Adminsitzung ist nicht mehr gültig.", 401);
  return session.email;
}
export async function login(email: string, password: string) {
  const stored = process.env.ADMIN_PASSWORD_HASH;
  if (!stored || !process.env.ADMIN_EMAIL) throw new AppError("Der Adminzugang ist noch nicht konfiguriert.", 503);
  const [salt, hash] = stored.split(":");
  if (!/^[a-f0-9]{32}$/.test(salt || "") || !/^[a-f0-9]{128}$/.test(hash || "")) throw new AppError("Der Adminzugang ist nicht korrekt konfiguriert.", 503);
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  if (!timingSafeEqual(expected, actual) || email.toLowerCase() !== process.env.ADMIN_EMAIL.toLowerCase()) {
    throw new AppError("E-Mail-Adresse oder Passwort ist falsch.", 401);
  }
  const token = signToken("admin", { email: process.env.ADMIN_EMAIL, fingerprint: fingerprint() }, 8 * 3600);
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 8 * 3600 });
}
export function csrfOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const configured = process.env.SITE_URL;
  const expected = configured ? new URL(configured).origin : new URL(request.url).origin;
  if (origin !== expected) throw new AppError("Diese Anfrage ist nicht erlaubt.", 403);
}
export async function rateLimit(request: Request, purpose: string, limit: number, seconds = 900) {
  const ip = process.env.VERCEL
    ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    : "local";
  const key = createHash("sha256").update(`${purpose}:${ip}`).digest("hex");
  const db = await database();
  const [row] = await db.query<{ count: number }>(`
    INSERT INTO rate_limits(key,count,expires_at) VALUES($1,1,now()+($2 * interval '1 second'))
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN rate_limits.expires_at < now() THEN 1 ELSE rate_limits.count+1 END,
      expires_at = CASE WHEN rate_limits.expires_at < now() THEN now()+($2 * interval '1 second') ELSE rate_limits.expires_at END
    RETURNING count`, [key, seconds]);
  if (row.count > limit) throw new AppError("Zu viele Anfragen. Bitte versuchen Sie es in einigen Minuten erneut.", 429);
}
