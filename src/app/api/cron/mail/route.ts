import { NextResponse } from "next/server";
import { database } from "@/lib/db";
import { drainOutbox, requireCron } from "@/lib/mail";
import { errorResponse } from "@/lib/http";

export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    requireCron(request);
    const db = await database();
    await db.query("DELETE FROM rate_limits WHERE expires_at < now()-interval '1 day'");
    return NextResponse.json(await drainOutbox(db), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
