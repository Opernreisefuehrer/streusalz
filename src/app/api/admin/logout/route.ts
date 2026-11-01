import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { csrfOrigin, SESSION_COOKIE } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export async function POST(request: Request) {
  try {
    csrfOrigin(request);
    (await cookies()).delete(SESSION_COOKIE);
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
