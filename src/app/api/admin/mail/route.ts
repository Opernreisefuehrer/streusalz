import { NextResponse } from "next/server";
import { z } from "zod";
import { csrfOrigin, requireAdmin } from "@/lib/auth";
import { database } from "@/lib/db";
import { drainOutbox } from "@/lib/mail";
import { readJson, errorResponse } from "@/lib/http";
import type { MailRow } from "@/lib/orders";
import { AppError } from "@/lib/errors";

export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    csrfOrigin(request);
    const actor = await requireAdmin();
    const { id } = await readJson(request, z.object({ id: z.uuid() }));
    const db = await database();
    const [mail] = await db.query<MailRow>("SELECT * FROM outbox WHERE id=$1", [id]);
    if (!mail) throw new AppError("E-Mail nicht gefunden.", 404);
    if (mail.status !== "pending" && mail.status !== "failed") throw new AppError("Diese E-Mail wurde bereits zum Versand übergeben oder wird gerade versendet.", 409);
    await db.query("UPDATE outbox SET attempts=0,status='pending' WHERE id=$1 AND status='failed'", [id]);
    await db.query("INSERT INTO audit_log(order_id,action,actor) VALUES($1,$2,$3)", [mail.order_id, `E-Mail-Versand erneut angestoßen: ${mail.subject}`, actor]);
    const result = await drainOutbox(db, 6, mail.order_id);
    const [updated] = await db.query<MailRow>("SELECT * FROM outbox WHERE id=$1", [id]);
    return NextResponse.json({ ...result, targetStatus: updated.status });
  } catch (error) { return errorResponse(error); }
}
