import { Pool } from "pg";

let pool: Pool | undefined;

export function getDatabase(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is required.");

    pool = new Pool({
      connectionString,
      enableChannelBinding: true,
      max: 3,
      connectionTimeoutMillis: 8000,
      statement_timeout: 10000,
    });
  }

  return pool;
}
