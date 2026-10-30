import "server-only";
import fs from "node:fs";
import path from "node:path";
import { runMigrations } from "./migrate";

/**
 * Minimal query interface shared by the two supported drivers:
 *  - DATABASE_URL set  → node-postgres Pool (Supabase / any PostgreSQL 15+)
 *  - DATABASE_URL unset → embedded PGlite (real PostgreSQL compiled to WASM)
 *    persisted under PGLITE_DIR (default ./.data/pglite)
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  driver: "postgres" | "pglite";
}

type GlobalWithDb = typeof globalThis & { __ccDb?: Promise<Db> };
const g = globalThis as GlobalWithDb;

async function createPostgres(url: string): Promise<Db> {
  const { Pool } = await import("pg");
  const needsSsl = !/localhost|127\.0\.0\.1/.test(url) && !/sslmode=disable/.test(url);
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    ssl: needsSsl ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
  });
  return {
    driver: "postgres",
    async query(sql, params = []) {
      const res = await pool.query(sql, params as unknown[]);
      return res.rows;
    },
    async exec(sql) {
      await pool.query(sql);
    },
  };
}

async function createPglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = path.resolve(process.env.PGLITE_DIR ?? ".data/pglite");
  fs.mkdirSync(dir, { recursive: true });
  const db = new PGlite(dir);
  await db.waitReady;
  // PGlite is single-connection; serialise access so concurrent requests
  // never interleave statements inside a transaction.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.catch(() => undefined);
    return next;
  };
  return {
    driver: "pglite",
    query: (sql, params = []) =>
      serial(async () => (await db.query(sql, params as unknown[])).rows as never),
    exec: (sql) => serial(async () => void (await db.exec(sql))),
  };
}

export function getDb(): Promise<Db> {
  if (!g.__ccDb) {
    g.__ccDb = (async () => {
      const url = process.env.DATABASE_URL;
      const db = url ? await createPostgres(url) : await createPglite();
      await runMigrations(db);
      return db;
    })().catch((err) => {
      g.__ccDb = undefined;
      throw err;
    });
  }
  return g.__ccDb;
}

export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  return db.query<T>(sql, params);
}

export async function q1<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}
