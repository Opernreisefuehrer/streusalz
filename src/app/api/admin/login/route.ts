import { NextResponse } from "next/server";
import { z } from "zod";
import { csrfOrigin, login, rateLimit } from "@/lib/auth";
import { readJson, errorResponse } from "@/lib/http";

export async function POST(request: Request) {
  try {
    csrfOrigin(request);
    await rateLimit(request, "login", 8);
    const body = await readJson(request, z.object({ email: z.email(), password: z.string().min(1).max(256) }));
    await login(body.email, body.password);
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
