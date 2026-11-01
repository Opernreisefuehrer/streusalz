import "server-only";
import { redirect } from "next/navigation";
import { requireAdmin } from "./auth";
import { AppError } from "./errors";

export async function adminPage() {
  try { return await requireAdmin(); }
  catch (error) {
    if (error instanceof AppError && error.status === 401) redirect("/admin/login");
    throw error;
  }
}
