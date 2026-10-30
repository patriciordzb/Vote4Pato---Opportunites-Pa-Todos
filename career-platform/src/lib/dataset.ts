import { z } from "zod";
import { isDomainKey } from "./taxonomy";

// Import format for verified research data (companies, participation evidence,
// recruiters, jobs). The bundled snapshot and user-supplied JSON both go
// through this schema, so imported data gets the same validation as the seed.

const httpsUrl = z.string().url().refine((u) => /^https?:\/\//.test(u), "must be http(s)");
const verification = z.enum(["verified", "partially_verified", "unverified"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const SourceSchema = z.object({
  key: z.string().min(1),
  url: httpsUrl,
  title: z.string().min(1),
  publisher: z.string().optional(),
  source_type: z.enum(["official_shpe", "company_official", "news", "university", "third_party", "user_provided"]),
  accessed_at: isoDate,
  access_note: z.string().optional(),
});

export const ParticipationSchema = z.object({
  event_year: z.number().int(),
  role: z.enum(["sponsor", "exhibitor", "ipc_partner", "event_partner", "academic_partner", "historical"]),
  tier: z.string().optional(),
  booth_number: z.string().max(20).optional(),
  booth_location: z.string().optional(),
  activities: z.array(z.string()).optional(),
  verification,
  source: z.string().optional(),
  evidence: z.string().min(1),
});

export const CompanySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  industry: z.string().min(1),
  industries: z.array(z.string()).default([]),
  headquarters: z.string().optional(),
  website: httpsUrl.optional(),
  domain: z.string().optional(),
  careers_url: httpsUrl.optional(),
  linkedin_url: httpsUrl.optional(),
  description: z.string().optional(),
  size: z.string().optional(),
  presence: z.string().optional(),
  products: z.array(z.string()).default([]),
  tags: z.record(z.string(), z.tuple([z.number().int().min(1).max(3), z.string()])).default({}),
  engineering_areas: z.array(z.string()).default([]),
  technical_challenges: z.array(z.string()).default([]),
  recent_developments: z.array(z.object({ text: z.string(), date: z.string().optional(), url: httpsUrl.optional() })).default([]),
  eligibility_notes: z.string().optional(),
  profile_verification: z.enum(["verified", "partially_verified", "unverified", "ai_analysis"]).optional(),
  participation: z.array(ParticipationSchema).default([]),
});

export const RecruiterSchema = z.object({
  company: z.string(),
  full_name: z.string().min(2).max(120),
  title: z.string().optional(),
  linkedin_url: z.string().regex(/^https:\/\/([a-z]+\.)?linkedin\.com\//).optional(),
  specialization: z.string().optional(),
  engineering_focus: z.string().optional(),
  background: z.string().optional(),
  attendance_status: z.enum(["confirmed", "potential", "unverified"]),
  evidence: z.array(z.object({ kind: z.enum(["attendance", "role", "other"]), text: z.string().min(1), source: z.string().optional() })).default([]),
}).refine(
  (r) => r.attendance_status !== "confirmed" || r.evidence.some((e) => e.kind === "attendance" && e.source),
  "A recruiter can only be 'confirmed' with sourced attendance evidence",
);

export const JobSchema = z.object({
  company: z.string(),
  title: z.string().min(1),
  requisition_id: z.string().nullable().optional(),
  location: z.string().optional(),
  employment_type: z.enum(["internship", "co_op", "full_time", "part_time", "research", "development_program", "other"]),
  description: z.string().optional(),
  qualifications: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  salary: z.string().optional(),
  deadline: isoDate.optional(),
  posted_at: isoDate.optional(),
  apply_url: httpsUrl.optional(),
  listing_status: z.enum(["open", "closed", "unknown"]).default("unknown"),
  verification,
  source: z.string().optional(),
  eligibility: z.object({
    citizenship_required: z.boolean().nullable().optional(),
    us_person_required: z.boolean().nullable().optional(),
    clearance_required: z.boolean().nullable().optional(),
    sponsorship: z.enum(["offered", "not_offered", "unknown"]).default("unknown"),
    note: z.string().optional(),
    evidence: z.string().optional(),
  }).optional(),
});

export const DatasetSchema = z.object({
  format: z.literal("shpe-cc-dataset/v1"),
  generated: isoDate,
  notes: z.string().optional(),
  event: z.unknown().optional(),
  sources: z.array(SourceSchema).default([]),
  companies: z.array(CompanySchema).default([]),
  recruiters: z.array(RecruiterSchema).default([]),
  jobs: z.array(JobSchema).default([]),
});

export type Dataset = z.infer<typeof DatasetSchema>;

type Query = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

export interface ImportSummary {
  sources: number;
  companies: number;
  participation: number;
  recruiters: number;
  jobs: number;
  warnings: string[];
}

/** Idempotent upsert of a validated dataset. */
export async function importDataset(query: Query, raw: unknown, createdBy: "seed" | "import"): Promise<ImportSummary> {
  const ds = DatasetSchema.parse(raw);
  const summary: ImportSummary = { sources: 0, companies: 0, participation: 0, recruiters: 0, jobs: 0, warnings: [] };
  const sourceIds = new Map<string, string>();

  for (const s of ds.sources) {
    const [row] = await query<{ id: string }>(
      `insert into sources (url, title, publisher, source_type, accessed_at, access_note)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (url) do update set title=excluded.title, publisher=excluded.publisher,
         source_type=excluded.source_type, accessed_at=excluded.accessed_at, access_note=excluded.access_note
       returning id`,
      [s.url, s.title, s.publisher ?? null, s.source_type, s.accessed_at, s.access_note ?? null],
    );
    sourceIds.set(s.key, row.id);
    summary.sources++;
  }
  const src = (key?: string) => {
    if (!key) return null;
    const id = sourceIds.get(key);
    if (!id) summary.warnings.push(`Unknown source key "${key}"`);
    return id ?? null;
  };

  const companyIds = new Map<string, string>();
  for (const c of ds.companies) {
    const tags: Record<string, { weight: number; context: string }> = {};
    for (const [k, [weight, context]] of Object.entries(c.tags)) {
      if (isDomainKey(k)) tags[k] = { weight, context };
      else summary.warnings.push(`${c.slug}: unknown tag "${k}" ignored`);
    }
    const [row] = await query<{ id: string }>(
      `insert into companies (slug, name, industry, industries, headquarters, website, domain, careers_url, linkedin_url,
         description, size, presence, products, tech_tags, engineering_areas, technical_challenges, recent_developments,
         eligibility_notes, profile_verification, created_by, last_verified_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21, now())
       on conflict (slug) do update set name=excluded.name, industry=excluded.industry, industries=excluded.industries,
         headquarters=excluded.headquarters, website=excluded.website, domain=excluded.domain, careers_url=excluded.careers_url,
         linkedin_url=excluded.linkedin_url, description=excluded.description, size=excluded.size, presence=excluded.presence,
         products=excluded.products, tech_tags=excluded.tech_tags, engineering_areas=excluded.engineering_areas,
         technical_challenges=excluded.technical_challenges, recent_developments=excluded.recent_developments,
         eligibility_notes=excluded.eligibility_notes, profile_verification=excluded.profile_verification,
         last_verified_at=excluded.last_verified_at, updated_at=now()
       returning id`,
      [
        c.slug, c.name, c.industry, c.industries, c.headquarters ?? null, c.website ?? null, c.domain ?? null,
        c.careers_url ?? null, c.linkedin_url ?? null, c.description ?? null, c.size ?? null, c.presence ?? null,
        c.products, JSON.stringify(tags), c.engineering_areas, c.technical_challenges,
        JSON.stringify(c.recent_developments), c.eligibility_notes ?? null,
        c.profile_verification ?? "partially_verified", createdBy, ds.generated,
      ],
    );
    companyIds.set(c.slug, row.id);
    summary.companies++;
    for (const p of c.participation) {
      await query(
        `insert into convention_participation (company_id, event_year, role, tier, booth_number, booth_location, activities,
           verification, evidence, source_id, verified_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         on conflict (company_id, event_year, role) do update set tier=excluded.tier, booth_number=excluded.booth_number,
           booth_location=excluded.booth_location, activities=excluded.activities, verification=excluded.verification,
           evidence=excluded.evidence, source_id=excluded.source_id, verified_at=excluded.verified_at`,
        [row.id, p.event_year, p.role, p.tier ?? null, p.booth_number ?? null, p.booth_location ?? null,
          p.activities ?? [], p.verification, p.evidence, src(p.source), ds.generated],
      );
      summary.participation++;
    }
  }

  const companyId = async (slug: string) => {
    if (companyIds.has(slug)) return companyIds.get(slug)!;
    const [row] = await query<{ id: string }>(`select id from companies where slug=$1`, [slug]);
    if (row) companyIds.set(slug, row.id);
    return row?.id ?? null;
  };

  for (const r of ds.recruiters) {
    const cid = await companyId(r.company);
    if (!cid) { summary.warnings.push(`Recruiter ${r.full_name}: unknown company ${r.company}`); continue; }
    const [row] = await query<{ id: string }>(
      `insert into recruiters (company_id, full_name, title, linkedin_url, specialization, engineering_focus, background,
         attendance_status, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'import')
       on conflict (company_id, full_name) do update set title=excluded.title, linkedin_url=excluded.linkedin_url,
         specialization=excluded.specialization, engineering_focus=excluded.engineering_focus, background=excluded.background,
         attendance_status=excluded.attendance_status
       returning id`,
      [cid, r.full_name, r.title ?? null, r.linkedin_url ?? null, r.specialization ?? null, r.engineering_focus ?? null,
        r.background ?? null, r.attendance_status],
    );
    await query(`delete from recruiter_evidence where recruiter_id=$1`, [row.id]);
    for (const e of r.evidence) {
      await query(`insert into recruiter_evidence (recruiter_id, kind, evidence, source_id) values ($1,$2,$3,$4)`,
        [row.id, e.kind, e.text, src(e.source)]);
    }
    summary.recruiters++;
  }

  for (const j of ds.jobs) {
    const cid = await companyId(j.company);
    if (!cid) { summary.warnings.push(`Job ${j.title}: unknown company ${j.company}`); continue; }
    const req = j.requisition_id ?? "";
    const [row] = await query<{ id: string }>(
      `insert into jobs (company_id, title, requisition_id, location, employment_type, description, qualifications, skills,
         salary, deadline, posted_at, apply_url, listing_status, verification, source_id, last_checked_at, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       on conflict (company_id, title, requisition_id) do update set location=excluded.location,
         employment_type=excluded.employment_type, description=excluded.description, qualifications=excluded.qualifications,
         skills=excluded.skills, salary=excluded.salary, deadline=excluded.deadline, posted_at=excluded.posted_at,
         apply_url=excluded.apply_url, listing_status=excluded.listing_status, verification=excluded.verification,
         source_id=excluded.source_id, last_checked_at=excluded.last_checked_at
       returning id`,
      [cid, j.title, req, j.location ?? null, j.employment_type, j.description ?? null, j.qualifications, j.skills,
        j.salary ?? null, j.deadline ?? null, j.posted_at ?? null, j.apply_url ?? null, j.listing_status, j.verification,
        src(j.source), ds.generated, createdBy],
    );
    const e = j.eligibility;
    await query(
      `insert into job_eligibility (job_id, citizenship_required, us_person_required, clearance_required, sponsorship, note, evidence, source_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (job_id) do update set citizenship_required=excluded.citizenship_required,
         us_person_required=excluded.us_person_required, clearance_required=excluded.clearance_required,
         sponsorship=excluded.sponsorship, note=excluded.note, evidence=excluded.evidence, source_id=excluded.source_id`,
      [row.id, e?.citizenship_required ?? null, e?.us_person_required ?? null, e?.clearance_required ?? null,
        e?.sponsorship ?? "unknown", e?.note ?? null, e?.evidence ?? null, src(j.source)],
    );
    summary.jobs++;
  }

  return summary;
}

/** Parse a CSV of companies/participation (one row per company). */
export function csvToDataset(csv: string): Dataset {
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error("CSV needs a header row and at least one data row");
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (r: string[], name: string) => {
    const i = header.indexOf(name);
    return i >= 0 ? (r[i] ?? "").trim() : "";
  };
  for (const required of ["name", "industry", "verification", "evidence"]) {
    if (!header.includes(required)) throw new Error(`CSV is missing required column "${required}"`);
  }
  const today = new Date().toISOString().slice(0, 10);
  const sources: Dataset["sources"] = [];
  const companies: Dataset["companies"] = [];
  for (const r of rows.slice(1)) {
    if (r.every((v) => !v.trim())) continue;
    const name = col(r, "name");
    const slug = (col(r, "slug") || name).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const sourceUrl = col(r, "source_url");
    let sourceKey: string | undefined;
    if (sourceUrl) {
      sourceKey = `csv-${slug}`;
      sources.push({ key: sourceKey, url: sourceUrl, title: col(r, "source_title") || `${name} — SHPE participation evidence`, source_type: (col(r, "source_type") || "user_provided") as Dataset["sources"][number]["source_type"], accessed_at: col(r, "accessed_at") || today });
    }
    companies.push(CompanySchema.parse({
      slug, name,
      industry: col(r, "industry"),
      industries: col(r, "industries") ? col(r, "industries").split("|").map((s) => s.trim()) : [col(r, "industry")],
      headquarters: col(r, "headquarters") || undefined,
      website: col(r, "website") || undefined,
      careers_url: col(r, "careers_url") || undefined,
      description: col(r, "description") || undefined,
      tags: Object.fromEntries((col(r, "tags") || "").split("|").filter(Boolean).map((t) => [t.trim(), [2, "imported tag"]])),
      participation: [{
        event_year: Number(col(r, "event_year") || 2026),
        role: (col(r, "role") || "exhibitor") as "exhibitor",
        tier: col(r, "tier") || undefined,
        booth_number: col(r, "booth_number") || undefined,
        verification: col(r, "verification") as "verified",
        evidence: col(r, "evidence"),
        source: sourceKey,
      }],
    }));
  }
  return DatasetSchema.parse({ format: "shpe-cc-dataset/v1", generated: today, sources, companies, recruiters: [], jobs: [] });
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
