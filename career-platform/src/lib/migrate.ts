import fs from "node:fs";
import path from "node:path";
import { importDataset } from "./dataset";
import dataset from "../../data/shpe2026-dataset.json";
import profileSeed from "../../data/profile.seed.json";

interface Runner {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
}

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");
const OWNER_ID = "00000000-0000-4000-8000-000000000001";

/** Apply pending SQL migrations, then load the bundled research snapshot and owner account. */
export async function runMigrations(db: Runner, log: (m: string) => void = () => {}) {
  await db.exec(`create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())`);
  const applied = new Set((await db.query<{ id: string }>(`select id from schema_migrations`)).map((r) => r.id));

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (applied.has(f)) continue;
    log(`applying ${f}`);
    await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"));
    await db.query(`insert into schema_migrations (id) values ($1) on conflict do nothing`, [f]);
  }

  // Re-import the research snapshot whenever its `generated` date changes.
  const seedId = `seed:dataset:${(dataset as { generated: string }).generated}`;
  if (!applied.has(seedId)) {
    log(`importing research snapshot ${seedId}`);
    const summary = await importDataset(db.query.bind(db) as Runner["query"], dataset, "seed");
    await db.query(`insert into data_imports (kind, filename, summary) values ('seed', 'shpe2026-dataset.json', $1)`, [JSON.stringify(summary)]);
    await db.query(`insert into schema_migrations (id) values ($1) on conflict do nothing`, [seedId]);
  }

  // Single-owner app: create the owner account and starting profile once.
  // A fixed id plus ON CONFLICT keeps this safe when several serverless
  // instances cold-start against a fresh database at the same time.
  const [owner] = await db.query<{ id: string }>(`select id from users order by created_at limit 1`);
  if (!owner) {
    log("creating owner account");
    await db.query(`insert into users (id, display_name) values ($1,$2) on conflict do nothing`, [OWNER_ID, profileSeed.data.fullName]);
    await db.query(
      `insert into professional_profiles (user_id, data, preferences, approved_at) values ($1,$2,$3, now()) on conflict do nothing`,
      [OWNER_ID, JSON.stringify(profileSeed.data), JSON.stringify(profileSeed.preferences)],
    );
  }
}
