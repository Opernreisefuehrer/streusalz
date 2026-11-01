import { NextResponse } from "next/server";
import { csrfOrigin, rateLimit } from "@/lib/auth";
import { quoteInputSchema } from "@/lib/validation";
import { createQuote } from "@/lib/pricing";
import { readJson, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    csrfOrigin(request);
    await rateLimit(request, "quote", 30);
    return NextResponse.json(await createQuote(await readJson(request, quoteInputSchema)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
