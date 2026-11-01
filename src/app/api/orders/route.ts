import { NextResponse } from "next/server";
import { csrfOrigin, rateLimit } from "@/lib/auth";
import { orderInputSchema, quoteInputFromOrder } from "@/lib/validation";
import { acceptedQuote } from "@/lib/pricing";
import { createOrder } from "@/lib/orders";
import { database } from "@/lib/db";
import { drainOutbox } from "@/lib/mail";
import { requireCheckout } from "@/lib/config";
import { readJson, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    csrfOrigin(request);
    requireCheckout();
    await rateLimit(request, "order", 10);
    const input = await readJson(request, orderInputSchema);
    const quote = acceptedQuote(input.quoteToken, quoteInputFromOrder(input));
    const db = await database();
    const order = await createOrder(db, input, quote);
    const mail = await drainOutbox(db, 6, order.id);
    return NextResponse.json({ number: order.number, mailPending: mail.pending > 0 }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
