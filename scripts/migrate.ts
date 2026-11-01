import { Pool } from "pg";
import { schema } from "../src/lib/schema.ts";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for migrations.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(schema);
  console.log("Shop schema successfully installed.");
} finally {
  await pool.end();
}
