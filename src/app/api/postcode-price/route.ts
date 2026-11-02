import { NextResponse } from "next/server";
import { csrfOrigin, rateLimit } from "@/lib/auth";
import { postcodePriceInputSchema } from "@/lib/validation";
import { createPostcodePrice } from "@/lib/pricing";
import { readJson, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    csrfOrigin(request);
    const input = await readJson(request, postcodePriceInputSchema);
    await rateLimit(request, "postcode-price", 30);
    return NextResponse.json(await createPostcodePrice(input), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
