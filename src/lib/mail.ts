import "server-only";
import nodemailer from "nodemailer";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import type { Database } from "./db";
import type { MailRow, DocumentRow } from "./orders";
import { buildPdf } from "./pdf";
import { AppError } from "./errors";

export async function drainOutbox(db: Database, limit = 6, orderId?: string) {
  let sent = 0;
  let failed = 0;
  for (let index = 0; index < limit; index++) {
    const [mail] = await db.query<MailRow>(`
      WITH candidate AS (
        SELECT queued.id FROM outbox queued
        WHERE ((queued.status IN ('pending','failed') AND queued.attempts < 5)
          OR (queued.status='sending' AND queued.locked_at < now()-interval '5 minutes'))
        AND ($1::uuid IS NULL OR queued.order_id=$1)
        AND NOT EXISTS (
          SELECT 1 FROM outbox previous
          WHERE previous.order_id=queued.order_id AND previous.recipient=queued.recipient
            AND previous.position < queued.position AND previous.status <> 'sent'
        )
        ORDER BY queued.position FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE outbox SET status='sending',locked_at=now(),attempts=attempts+1
      WHERE id IN (SELECT id FROM candidate) RETURNING *`, [orderId ?? null]);
    if (!mail) break;
    try {
      let attachment: { filename: string; content: Buffer } | undefined;
      if (mail.document_id) {
        const [document] = await db.query<DocumentRow>("SELECT * FROM documents WHERE id=$1", [mail.document_id]);
        if (!document) throw new Error("Queued document not found.");
        attachment = { filename: `${document.number}.pdf`, content: await buildPdf(document) };
      }
      const preview = process.env.MAIL_MODE === "preview";
      if (preview && (process.env.VERCEL || process.env.NODE_ENV === "production")) throw new Error("Preview mail delivery is forbidden in production.");
      if (!preview && (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD)) throw new Error("SMTP is not configured.");
      const transport = preview
        ? nodemailer.createTransport({ streamTransport: true, buffer: true })
        : nodemailer.createTransport({
          host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_PORT === "465", requireTLS: process.env.SMTP_PORT !== "465",
          auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! },
          connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000,
        });
      const result = await transport.sendMail({
        from: process.env.MAIL_FROM || "info@streusalz-grosshandel.de", to: mail.recipient,
        subject: mail.subject, text: mail.body,
        messageId: `<${mail.id}@streusalz-grosshandel.de>`,
        attachments: attachment ? [attachment] : [],
      });
      if (preview) {
        await mkdir(".mail-preview", { recursive: true });
        await writeFile(join(".mail-preview", `${mail.id}.eml`), result.message);
      } else if (!result.accepted?.length || result.rejected?.length) {
        throw new Error("SMTP server did not accept the recipient.");
      }
      await db.query("UPDATE outbox SET status='sent',sent_at=now(),last_error=NULL,locked_at=NULL WHERE id=$1", [mail.id]);
      sent++;
    } catch (error) {
      console.error("Outbox delivery failed", mail.id, error instanceof Error ? error.message : "Unknown mail error");
      const message = error instanceof AppError ? error.message : "Versand fehlgeschlagen. SMTP-Konfiguration und Serverprotokoll prüfen.";
      await db.query("UPDATE outbox SET status='failed',last_error=$2,locked_at=NULL WHERE id=$1", [mail.id, message]);
      failed++;
      // Do not exhaust all retry attempts in one request or retry an unhealthy service immediately.
      break;
    }
  }
  const [{ pending }] = await db.query<{ pending: number }>("SELECT count(*)::int AS pending FROM outbox WHERE status<>'sent' AND ($1::uuid IS NULL OR order_id=$1)", [orderId ?? null]);
  return { sent, failed, pending };
}
export function requireCron(request: Request) {
  const expected = process.env.CRON_SECRET;
  const value = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!expected || expected.length < 32 || !value) throw new AppError("Nicht autorisiert.", 401);
  const a = Buffer.from(expected), b = Buffer.from(value);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new AppError("Nicht autorisiert.", 401);
}
