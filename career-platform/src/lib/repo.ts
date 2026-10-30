import "server-only";
import { cache } from "react";
import { q, q1 } from "./db";
import { analyzeProfile, type ProfileIntel } from "./intel";
import { scoreCompany, type Assessment } from "./scoring";
import type {
  Application, Company, CompanyTracking, Interaction, Job, Participation, Preferences, Profile, ProfileData,
  Recruiter, RecruiterContact, Task,
} from "./types";

// All reads/writes of user-owned rows go through here and always filter by
// user_id, so authorization is enforced in one place.

export const getOwnerId = cache(async (): Promise<string> => {
  const row = await q1<{ id: string }>(`select id from users order by created_at limit 1`);
  if (!row) throw new Error("No owner account. Run `npm run db:migrate`.");
  return row.id;
});

export const getProfile = cache(async (userId: string): Promise<Profile> => {
  const row = await q1<{ user_id: string; data: Partial<ProfileData>; preferences: Preferences; version: number; updated_at: Date }>(
    `select user_id, data, preferences, version, updated_at from professional_profiles where user_id=$1`, [userId]);
  if (!row) throw new Error("Profile missing");
  const data: ProfileData = {
    fullName: "", education: [], experience: [], research: [], projects: [], publications: [], leadership: [],
    skillGroups: [], certifications: [], affiliations: [], ...(row.data as Partial<ProfileData>),
  };
  return { userId: row.user_id, data, preferences: row.preferences, version: row.version, updatedAt: new Date(row.updated_at).toISOString() };
});

export async function saveProfile(userId: string, data: ProfileData, prefs: Preferences) {
  await q(
    `update professional_profiles set data=$2, preferences=$3, version=version+1, approved_at=now(), updated_at=now() where user_id=$1`,
    [userId, JSON.stringify(data), JSON.stringify(prefs)],
  );
}

const PARTICIPATION_SQL = `
  select p.*, to_char(p.verified_at,'YYYY-MM-DD') as verified_at, s.url as source_url, s.title as source_title,
         s.source_type, s.access_note
  from convention_participation p left join sources s on s.id = p.source_id`;

const COMPANY_COLS = `id, slug, name, industry, industries, headquarters, website, domain, careers_url, linkedin_url, description,
  size, presence, products, tech_tags, engineering_areas, recent_developments, technical_challenges, eligibility_notes,
  profile_verification, to_char(last_verified_at,'YYYY-MM-DD') as last_verified_at, created_by`;

export const listCompanies = cache(async (): Promise<Company[]> =>
  q<Company>(`select ${COMPANY_COLS} from companies order by name`));

export async function getCompanyBySlug(slug: string): Promise<Company | null> {
  return q1<Company>(`select ${COMPANY_COLS} from companies where slug=$1`, [slug]);
}

export const listParticipation = cache(async (): Promise<Participation[]> =>
  q<Participation>(`${PARTICIPATION_SQL} order by p.event_year desc`));

const JOB_SQL = `
  select j.id, j.company_id, c.name as company_name, c.slug as company_slug, j.title, nullif(j.requisition_id,'') as requisition_id,
    j.location, j.employment_type, j.description, j.qualifications, j.skills, j.salary,
    to_char(j.deadline,'YYYY-MM-DD') as deadline, to_char(j.posted_at,'YYYY-MM-DD') as posted_at, j.apply_url,
    j.listing_status, j.verification, to_char(j.last_checked_at,'YYYY-MM-DD') as last_checked_at, j.created_by,
    s.url as source_url,
    case when e.job_id is null then null else json_build_object(
      'citizenship_required', e.citizenship_required, 'us_person_required', e.us_person_required,
      'clearance_required', e.clearance_required, 'sponsorship', e.sponsorship, 'note', e.note, 'evidence', e.evidence) end as eligibility
  from jobs j join companies c on c.id=j.company_id
  left join job_eligibility e on e.job_id=j.id
  left join sources s on s.id=j.source_id`;

export const listJobs = cache(async (): Promise<Job[]> => q<Job>(`${JOB_SQL} order by c.name, j.title`));

export async function getJob(id: string): Promise<Job | null> {
  return q1<Job>(`${JOB_SQL} where j.id=$1`, [id]);
}

export const listRecruiters = cache(async (userId: string): Promise<Recruiter[]> => {
  const rows = await q<Recruiter & { contact: RecruiterContact | null }>(`
    select r.id, r.company_id, c.name as company_name, c.slug as company_slug, r.full_name, r.title, r.linkedin_url,
      r.specialization, r.engineering_focus, r.background, r.attendance_status, r.created_by,
      coalesce((select json_agg(json_build_object('kind', e.kind, 'evidence', e.evidence, 'source_url', s.url))
        from recruiter_evidence e left join sources s on s.id=e.source_id where e.recruiter_id=r.id), '[]'::json) as evidence,
      (select row_to_json(rc) from recruiter_contacts rc where rc.recruiter_id=r.id and rc.user_id=$1) as contact
    from recruiters r join companies c on c.id=r.company_id
    order by case r.attendance_status when 'confirmed' then 0 when 'potential' then 1 else 2 end, c.name, r.full_name`, [userId]);
  return rows;
});

export const listTracking = cache(async (userId: string): Promise<Map<string, CompanyTracking>> => {
  const rows = await q<CompanyTracking>(`select company_id, saved, status, visit_order, visited_at, mutual_connections, notes from company_tracking where user_id=$1`, [userId]);
  return new Map(rows.map((r) => [r.company_id, r]));
});

export const listInteractions = cache(async (userId: string): Promise<Interaction[]> =>
  q<Interaction>(`
    select i.id, i.company_id, c.name as company_name, c.slug as company_slug, i.recruiter_id, r.full_name as recruiter_name,
      i.kind, i.occurred_at, i.summary, i.opportunities_discussed, i.impressions
    from interactions i left join companies c on c.id=i.company_id left join recruiters r on r.id=i.recruiter_id
    where i.user_id=$1 order by i.occurred_at desc`, [userId]));

export const listTasks = cache(async (userId: string): Promise<Task[]> =>
  q<Task>(`
    select t.id, t.company_id, c.name as company_name, c.slug as company_slug, t.recruiter_id, t.application_id, t.title,
      to_char(t.due_at,'YYYY-MM-DD') as due_at, t.done
    from tasks t left join companies c on c.id=t.company_id
    where t.user_id=$1 order by t.done, t.due_at nulls last, t.created_at`, [userId]));

export const listApplications = cache(async (userId: string): Promise<Application[]> =>
  q<Application>(`
    select a.id, a.job_id, a.company_id, c.name as company_name, c.slug as company_slug, a.recruiter_id, a.title, a.url, a.status,
      to_char(a.applied_at,'YYYY-MM-DD') as applied_at, a.notes, a.updated_at
    from applications a join companies c on c.id=a.company_id where a.user_id=$1 order by a.updated_at desc`, [userId]));

export async function listDrafts(userId: string, companyId?: string) {
  return q<{ id: string; kind: string; body: string; generated_by: string; created_at: string; company_name: string | null; recruiter_name: string | null }>(`
    select d.id, d.kind, d.body, d.generated_by, d.created_at, c.name as company_name, r.full_name as recruiter_name
    from outreach_drafts d left join companies c on c.id=d.company_id left join recruiters r on r.id=d.recruiter_id
    where d.user_id=$1 and ($2::uuid is null or d.company_id=$2) order by d.created_at desc limit 50`, [userId, companyId ?? null]);
}

export async function listNotes(userId: string, entityType: string, entityId: string | null) {
  return q<{ id: string; body: string; created_at: string }>(
    `select id, body, created_at from notes where user_id=$1 and entity_type=$2 and entity_id is not distinct from $3 order by created_at desc`,
    [userId, entityType, entityId]);
}

export async function listDocuments(userId: string) {
  return q<{ id: string; kind: string; filename: string; size_bytes: number; created_at: string; review_status: string; has_text: boolean; analysis: unknown }>(
    `select id, kind, filename, size_bytes, created_at, review_status, (extracted_text is not null and length(extracted_text) > 0) as has_text, analysis
     from documents where user_id=$1 order by created_at desc`, [userId]);
}

export async function getLinkedIn(userId: string) {
  return q1<{ linkedin_sub: string; name: string | null; email: string | null; picture_url: string | null; scopes: string | null; connected_at: string; token_expires_at: string | null; locale: string | null; email_verified: boolean | null }>(
    `select linkedin_sub, name, email, picture_url, scopes, connected_at, token_expires_at, locale, email_verified from linkedin_connections where user_id=$1`, [userId]);
}

// ---------------------------------------------------------------------------
// Assessments
// ---------------------------------------------------------------------------

export interface Workspace {
  userId: string;
  profile: Profile;
  intel: ProfileIntel;
  companies: Company[];
  participation: Map<string, Participation[]>;
  jobs: Map<string, Job[]>;
  recruiters: Recruiter[];
  tracking: Map<string, CompanyTracking>;
  interactions: Interaction[];
  assessments: Map<string, Assessment>;
}

/** Load everything a page needs and score every company against the current profile. */
export const getWorkspace = cache(async (): Promise<Workspace> => {
  const userId = await getOwnerId();
  const [profile, companies, parts, jobs, recruiters, tracking, interactions] = await Promise.all([
    getProfile(userId), listCompanies(), listParticipation(), listJobs(), listRecruiters(userId), listTracking(userId), listInteractions(userId),
  ]);
  const intel = analyzeProfile(profile.data);
  const participation = groupBy(parts, (p) => p.company_id);
  const jobsBy = groupBy(jobs, (j) => j.company_id);
  const recruitersBy = groupBy(recruiters, (r) => r.company_id);
  const interactionsBy = groupBy(interactions.filter((i) => i.company_id), (i) => i.company_id!);
  const assessments = new Map<string, Assessment>();
  for (const c of companies) {
    assessments.set(c.id, scoreCompany({
      company: c,
      participation: participation.get(c.id) ?? [],
      jobs: jobsBy.get(c.id) ?? [],
      recruiterCount: recruitersBy.get(c.id)?.length ?? 0,
      interactionCount: interactionsBy.get(c.id)?.length ?? 0,
      intel,
      prefs: profile.preferences,
    }));
  }
  void persistAssessments(userId, profile.version, assessments).catch(() => undefined);
  return { userId, profile, intel, companies, participation, jobs: jobsBy, recruiters, tracking, interactions, assessments };
});

async function persistAssessments(userId: string, version: number, assessments: Map<string, Assessment>) {
  const existing = await q1<{ n: number }>(`select count(*)::int as n from compatibility_assessments where user_id=$1 and profile_version=$2`, [userId, version]);
  if (existing && existing.n === assessments.size) return;
  for (const [companyId, a] of assessments) {
    await q(
      `insert into compatibility_assessments (user_id, company_id, score, confidence, breakdown, eligibility, profile_version, computed_at)
       values ($1,$2,$3,$4,$5,$6,$7, now())
       on conflict (user_id, company_id) do update set score=excluded.score, confidence=excluded.confidence,
         breakdown=excluded.breakdown, eligibility=excluded.eligibility, profile_version=excluded.profile_version, computed_at=now()`,
      [userId, companyId, a.score, a.confidence, JSON.stringify(a.factors), JSON.stringify(a.eligibility), version],
    );
  }
}

export function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const arr = m.get(k);
    if (arr) arr.push(r);
    else m.set(k, [r]);
  }
  return m;
}

export function bestParticipation(parts: Participation[] = []) {
  const order = { verified: 0, partially_verified: 1, unverified: 2 } as const;
  const roleOrder: Record<string, number> = { exhibitor: 0, sponsor: 1, event_partner: 2, academic_partner: 3, ipc_partner: 4, historical: 5 };
  return [...parts]
    .filter((p) => p.event_year === 2026 && p.role !== "historical")
    .sort((a, b) => order[a.verification] - order[b.verification] || (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9))[0] ?? null;
}

export function boothOf(parts: Participation[] = []) {
  return parts.find((p) => p.event_year === 2026 && p.booth_number)?.booth_number ?? null;
}
