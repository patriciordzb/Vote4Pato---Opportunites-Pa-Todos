// Apply migrations + seed outside of Next.js: `npm run db:migrate`.
// Uses DATABASE_URL when set, otherwise the embedded PGlite store.
import fs from "node:fs";
import path from "node:path";
import { runMigrations } from "../src/lib/migrate";

async function main() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
    await runMigrations(
      { query: async (s, p = []) => (await pool.query(s, p as unknown[])).rows, exec: async (s) => void (await pool.query(s)) },
      console.log,
    );
    await pool.end();
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const dir = path.resolve(process.env.PGLITE_DIR ?? ".data/pglite");
    fs.mkdirSync(dir, { recursive: true });
    const db = new PGlite(dir);
    await runMigrations(
      { query: async (s, p = []) => (await db.query(s, p as unknown[])).rows as never, exec: async (s) => void (await db.exec(s)) },
      console.log,
    );
    await db.close();
  }
  console.log("database ready");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
