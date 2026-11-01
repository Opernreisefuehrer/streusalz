import { NextResponse } from "next/server";
import { csrfOrigin, rateLimit } from "@/lib/auth";
import { freightEstimateInputSchema } from "@/lib/validation";
import { createFreightEstimate } from "@/lib/pricing";
import { readJson, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    csrfOrigin(request);
    const input = await readJson(request, freightEstimateInputSchema);
    await rateLimit(request, "freight-estimate", 30);
    return NextResponse.json(await createFreightEstimate(input), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
