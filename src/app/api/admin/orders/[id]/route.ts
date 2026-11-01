import { NextResponse } from "next/server";
import { z } from "zod";
import { csrfOrigin, requireAdmin } from "@/lib/auth";
import { database } from "@/lib/db";
import { confirmSupplier, releaseInvoices, markDelivered } from "@/lib/orders";
import { drainOutbox } from "@/lib/mail";
import { readJson, errorResponse } from "@/lib/http";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm"), reference: z.string().trim().min(1).max(200) }),
  z.object({ action: z.literal("invoice") }),
  z.object({ action: z.literal("deliver"), dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(3) }),
]);
export const maxDuration = 60;
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    csrfOrigin(request);
    const actor = await requireAdmin();
    const { id } = await context.params;
    z.uuid().parse(id);
    const action = await readJson(request, actionSchema);
    const db = await database();
    if (action.action === "confirm") await confirmSupplier(db, id, action.reference, actor);
    else if (action.action === "invoice") await releaseInvoices(db, id, actor);
    else await markDelivered(db, id, action.dates, actor);
    const mail = await drainOutbox(db, 6, id);
    return NextResponse.json({ ok: true, mailFailed: mail.pending > 0 });
  } catch (error) { return errorResponse(error); }
}
