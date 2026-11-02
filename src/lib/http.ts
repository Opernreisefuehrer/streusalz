import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError } from "./errors";

export async function readJson<T>(request: Request, validator: z.ZodType<T>) {
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > 24000) throw new AppError("Die Anfrage ist zu groß.", 413);
  let body: unknown;
  try { body = JSON.parse(text); }
  catch { throw new AppError("Die Anfrage enthält ungültige Daten."); }
  return validator.parse(body);
}
export function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Bitte Eingaben prüfen." }, { status: 400 });
  if (error instanceof AppError) return NextResponse.json({ error: error.message, ...(error.code ? { code: error.code } : {}) }, { status: error.status });
  console.error("Shop request failed", error);
  return NextResponse.json({ error: "Die Anfrage konnte nicht verarbeitet werden. Bitte versuchen Sie es später erneut oder kontaktieren Sie uns." }, { status: 500 });
}
