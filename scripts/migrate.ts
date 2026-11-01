import { Pool } from "pg";
import { schema } from "../src/lib/schema.ts";

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_DATABASE_URL or DATABASE_URL is required for migrations.");
const pool = new Pool({ connectionString });
try {
  await pool.query(schema);
  console.log("Shop schema successfully installed.");
} finally {
  await pool.end();
}
