import "server-only";
import { Pool, type QueryResultRow } from "pg";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { schema } from "./schema";
import { AppError } from "./errors";

export interface Database {
  query<T extends QueryResultRow>(sql: string, values?: unknown[]): Promise<T[]>;
  transaction<T>(fn: (db: Database) => Promise<T>): Promise<T>;
}

export function embeddedDatabase(client: PGlite | Transaction): Database {
  return {
    async query<T extends QueryResultRow>(sql: string, values: unknown[] = []) {
      return (await client.query<T>(sql, values)).rows;
    },
    transaction: (fn) => {
      if (!("transaction" in client)) throw new Error("Nested transactions are not supported.");
      return client.transaction((tx) => fn(embeddedDatabase(tx)));
    },
  };
}

function postgresDatabase(pool: Pool): Database {
  return {
    async query<T extends QueryResultRow>(sql: string, values: unknown[] = []) {
      return (await pool.query<T>(sql, values)).rows;
    },
    async transaction(fn) {
      const client = await pool.connect();
      const transaction: Database = {
        async query<T extends QueryResultRow>(sql: string, values: unknown[] = []) {
          return (await client.query<T>(sql, values)).rows;
        },
        transaction: () => { throw new Error("Nested transactions are not supported."); },
      };
      try {
        await client.query("BEGIN");
        const result = await fn(transaction);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

const globalDb = globalThis as typeof globalThis & { shopDatabase?: Promise<Database> };
export function database(): Promise<Database> {
  globalDb.shopDatabase ??= connect();
  return globalDb.shopDatabase;
}
async function connect(): Promise<Database> {
  if (process.env.DATABASE_URL) {
    return postgresDatabase(new Pool({ connectionString: process.env.DATABASE_URL, max: 3 }));
  }
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    throw new AppError("Die Bestelldatenbank ist noch nicht konfiguriert.", 503);
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite(".local-db");
  await client.exec(schema);
  console.info("Shop development: persistent local PGlite database (.local-db).");
  return embeddedDatabase(client);
}
