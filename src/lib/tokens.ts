import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { signingSecret } from "./config";
import { AppError } from "./errors";

export function signToken(purpose: string, payload: unknown, lifetimeSeconds: number) {
  const body = Buffer.from(JSON.stringify({ purpose, expires: Date.now() + lifetimeSeconds * 1000, payload })).toString("base64url");
  return `${body}.${createHmac("sha256", signingSecret()).update(body).digest("base64url")}`;
}
export function verifyToken<T>(token: string, purpose: string, validator: z.ZodType<T>): T {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) throw new AppError("Ungültige oder abgelaufene Sitzung. Bitte erneut versuchen.", 401);
  const expected = createHmac("sha256", signingSecret()).update(body).digest();
  const actual = Buffer.from(signature, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new AppError("Ungültige oder abgelaufene Sitzung. Bitte erneut versuchen.", 401);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); }
  catch { throw new AppError("Ungültige Sitzung.", 401); }
  const envelope = z.object({ purpose: z.literal(purpose), expires: z.number().min(Date.now()), payload: validator }).safeParse(parsed);
  if (!envelope.success) throw new AppError("Die Sitzung oder Preisberechnung ist abgelaufen. Bitte erneut starten.", 401);
  return envelope.data.payload;
}
