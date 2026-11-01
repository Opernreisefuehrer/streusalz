import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { database } from "@/lib/db";
import type { DocumentRow } from "@/lib/orders";
import { buildPdf } from "@/lib/pdf";
import { AppError } from "@/lib/errors";
import { errorResponse } from "@/lib/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    z.uuid().parse(id);
    const [document] = await (await database()).query<DocumentRow>("SELECT * FROM documents WHERE id=$1", [id]);
    if (!document) throw new AppError("Dokument nicht gefunden.", 404);
    return new Response(new Uint8Array(await buildPdf(document)), { headers: {
      "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${document.number}.pdf"`, "Cache-Control": "private, no-store",
    } });
  } catch (error) { return errorResponse(error); }
}
