"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { q, q1 } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { getOwnerId, getProfile, saveProfile } from "@/lib/repo";
import { SESSION_COOKIE, authMode, createSessionToken, sessionCookieOptions } from "@/lib/session";
import { APPLICATION_STATUSES, CRM_STATUSES, type Preferences, type ProfileData } from "@/lib/types";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function fail(e: unknown): ActionResult {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ") };
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
}

const str = (max: number) => z.string().trim().max(max);
const optStr = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const optUuid = z.string().uuid().optional().or(z.literal("")).transform((v) => (v ? v : null));
const optDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")).transform((v) => (v ? v : null));
const optUrl = z.string().trim().url().refine((u) => /^https?:\/\//.test(u), "must be http(s)").optional().or(z.literal("")).transform((v) => (v ? v : null));

function form(fd: FormData) {
  return Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
}

function refresh() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export async function signIn(_: unknown, fd: FormData): Promise<ActionResult> {
  const mode = authMode();
  if (mode === "misconfigured") return { ok: false, error: "Server is not configured: set APP_PASSWORD and SESSION_SECRET (32+ chars)." };
  if (mode === "password") {
    const given = createHash("sha256").update(String(fd.get("password") ?? "")).digest();
    const expected = createHash("sha256").update(process.env.APP_PASSWORD!).digest();
    if (!timingSafeEqual(given, expected)) return { ok: false, error: "Incorrect password." };
  }
  const owner = await getOwnerId();
  (await cookies()).set(SESSION_COOKIE, await createSessionToken({ sub: owner }), sessionCookieOptions);
  const next = String(fd.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function setTheme(theme: "light" | "dark") {
  (await cookies()).set("theme", theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  refresh();
}

// ---------------------------------------------------------------------------
// Company tracking (CRM)
// ---------------------------------------------------------------------------

const TrackingSchema = z.object({
  saved: z.boolean().optional(),
  status: z.enum(CRM_STATUSES).optional(),
  visit_order: z.number().int().min(1).max(999).nullable().optional(),
  visited: z.boolean().optional(),
  mutual_connections: z.string().max(2000).nullable().optional(),
  notes: z.string().max(10000).nullable().optional(),
});

export async function updateCompanyTracking(companyId: string, patch: z.input<typeof TrackingSchema>): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const p = TrackingSchema.parse(patch);
    z.string().uuid().parse(companyId);
    await q(`insert into company_tracking (user_id, company_id) values ($1,$2) on conflict do nothing`, [userId, companyId]);
    await q(
      `update company_tracking set
         saved = coalesce($3, saved),
         status = coalesce($4, status),
         visit_order = case when $5::boolean then $6 else visit_order end,
         visited_at = case when $7::boolean is null then visited_at when $7 then coalesce(visited_at, now()) else null end,
         mutual_connections = case when $8::boolean then $9 else mutual_connections end,
         notes = case when $10::boolean then $11 else notes end,
         updated_at = now()
       where user_id=$1 and company_id=$2`,
      [userId, companyId, p.saved ?? null, p.status ?? null, "visit_order" in p, p.visit_order ?? null,
        p.visited ?? null, "mutual_connections" in p, p.mutual_connections ?? null, "notes" in p, p.notes ?? null],
    );
    if (p.visited) {
      await q(`update company_tracking set status='visited_booth' where user_id=$1 and company_id=$2 and status in ('none','want_to_meet','high_priority')`, [userId, companyId]);
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Interactions, tasks, notes
// ---------------------------------------------------------------------------

const InteractionSchema = z.object({
  company_id: z.string().uuid(),
  recruiter_id: optUuid,
  kind: z.enum(["booth_visit", "conversation", "linkedin", "email", "interview", "info_session", "other"]),
  occurred_at: z.string().optional(),
  summary: str(5000).min(1, "Add a short summary"),
  opportunities_discussed: optStr(2000),
  impressions: optStr(2000),
  follow_up: optStr(300),
  follow_up_due: optDate,
  new_status: z.enum(CRM_STATUSES).optional().or(z.literal("")),
});

export async function addInteraction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const d = InteractionSchema.parse(form(fd));
    const when = d.occurred_at ? new Date(d.occurred_at) : new Date();
    if (Number.isNaN(when.getTime())) throw new Error("Invalid date");
    await q(
      `insert into interactions (user_id, company_id, recruiter_id, kind, occurred_at, summary, opportunities_discussed, impressions)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [userId, d.company_id, d.recruiter_id, d.kind, when.toISOString(), d.summary, d.opportunities_discussed, d.impressions],
    );
    if (d.follow_up) {
      await q(`insert into tasks (user_id, company_id, recruiter_id, title, due_at) values ($1,$2,$3,$4,$5)`,
        [userId, d.company_id, d.recruiter_id, d.follow_up, d.follow_up_due]);
    }
    const status = d.new_status || (d.kind === "booth_visit" ? "visited_booth" : d.kind === "conversation" ? "met_recruiter" : "");
    if (status) {
      await q(`insert into company_tracking (user_id, company_id, status, visited_at) values ($1,$2,$3, case when $4 then now() end)
               on conflict (user_id, company_id) do update set status=excluded.status,
                 visited_at=coalesce(company_tracking.visited_at, excluded.visited_at), updated_at=now()`,
        [userId, d.company_id, status, d.kind === "booth_visit" || d.kind === "conversation"]);
    }
    refresh();
    return { ok: true, message: "Interaction saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteInteraction(id: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await q(`delete from interactions where id=$1 and user_id=$2`, [z.string().uuid().parse(id), userId]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const TaskSchema = z.object({
  title: str(300).min(1, "Task needs a title"),
  due_at: optDate,
  company_id: optUuid,
  recruiter_id: optUuid,
  application_id: optUuid,
});

export async function addTask(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const d = TaskSchema.parse(form(fd));
    await q(`insert into tasks (user_id, title, due_at, company_id, recruiter_id, application_id) values ($1,$2,$3,$4,$5,$6)`,
      [userId, d.title, d.due_at, d.company_id, d.recruiter_id, d.application_id]);
    refresh();
    return { ok: true, message: "Task added" };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleTask(id: string, done: boolean): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await q(`update tasks set done=$3, done_at=case when $3 then now() end where id=$1 and user_id=$2`, [z.string().uuid().parse(id), userId, done]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await q(`delete from tasks where id=$1 and user_id=$2`, [z.string().uuid().parse(id), userId]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function addNote(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const d = z.object({
      entity_type: z.enum(["company", "recruiter", "job", "general"]),
      entity_id: optUuid,
      body: str(10000).min(1, "Note is empty"),
    }).parse(form(fd));
    await q(`insert into notes (user_id, entity_type, entity_id, body) values ($1,$2,$3,$4)`, [userId, d.entity_type, d.entity_id, d.body]);
    refresh();
    return { ok: true, message: "Note saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteNote(id: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await q(`delete from notes where id=$1 and user_id=$2`, [z.string().uuid().parse(id), userId]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Recruiters
// ---------------------------------------------------------------------------

const RecruiterSchema = z.object({
  company_id: z.string().uuid(),
  full_name: str(120).min(2, "Name is required"),
  title: optStr(200),
  linkedin_url: z.string().trim().regex(/^https:\/\/([a-z]+\.)?linkedin\.com\/.+/, "Must be a https://linkedin.com/... URL").optional().or(z.literal("")).transform((v) => (v ? v : null)),
  specialization: optStr(300),
  engineering_focus: optStr(300),
  background: optStr(2000),
  attendance_status: z.enum(["confirmed", "potential", "unverified"]),
  evidence_url: optUrl,
  evidence_text: optStr(1000),
});

export async function addRecruiter(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const d = RecruiterSchema.parse(form(fd));
    if (d.attendance_status === "confirmed" && !(d.evidence_url && d.evidence_text)) {
      throw new Error("'Confirmed attending' needs evidence: a source URL and what it says. Met them at the booth? Paste your note and choose 'Potential contact'.");
    }
    const [row] = await q<{ id: string }>(
      `insert into recruiters (company_id, full_name, title, linkedin_url, specialization, engineering_focus, background, attendance_status, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'user')
       on conflict (company_id, full_name) do update set title=coalesce(excluded.title, recruiters.title),
         linkedin_url=coalesce(excluded.linkedin_url, recruiters.linkedin_url)
       returning id`,
      [d.company_id, d.full_name, d.title, d.linkedin_url, d.specialization, d.engineering_focus, d.background, d.attendance_status],
    );
    if (d.evidence_url || d.evidence_text) {
      let sourceId: string | null = null;
      if (d.evidence_url) {
        const s = await q1<{ id: string }>(
          `insert into sources (url, title, source_type, accessed_at) values ($1,$2,'user_provided', current_date)
           on conflict (url) do update set accessed_at=current_date returning id`,
          [d.evidence_url, `Evidence for ${d.full_name}`]);
        sourceId = s?.id ?? null;
      }
      await q(`insert into recruiter_evidence (recruiter_id, kind, evidence, source_id) values ($1,$2,$3,$4)`,
        [row.id, d.attendance_status === "confirmed" ? "attendance" : "other", d.evidence_text ?? "Source provided by user", sourceId]);
    }
    await q(`insert into recruiter_contacts (user_id, recruiter_id, saved) values ($1,$2,true) on conflict do nothing`, [userId, row.id]);
    refresh();
    return { ok: true, message: "Recruiter saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function updateRecruiterContact(recruiterId: string, patch: { saved?: boolean; status?: string; notes?: string; mutual_connections?: string; contact_email?: string; contact_phone?: string }): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const p = z.object({
      saved: z.boolean().optional(),
      status: z.enum(CRM_STATUSES).optional(),
      notes: z.string().max(10000).optional(),
      mutual_connections: z.string().max(2000).optional(),
      contact_email: z.string().email().or(z.literal("")).optional(),
      contact_phone: z.string().max(40).optional(),
    }).parse(patch);
    await q(`insert into recruiter_contacts (user_id, recruiter_id) values ($1,$2) on conflict do nothing`, [userId, z.string().uuid().parse(recruiterId)]);
    await q(
      `update recruiter_contacts set saved=coalesce($3,saved), status=coalesce($4,status), notes=coalesce($5,notes),
         mutual_connections=coalesce($6,mutual_connections), contact_email=coalesce(nullif($7,''),contact_email),
         contact_phone=coalesce(nullif($8,''),contact_phone), updated_at=now()
       where user_id=$1 and recruiter_id=$2`,
      [userId, recruiterId, p.saved ?? null, p.status ?? null, p.notes ?? null, p.mutual_connections ?? null, p.contact_email ?? null, p.contact_phone ?? null],
    );
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRecruiter(recruiterId: string): Promise<ActionResult> {
  try {
    await requireUserId();
    await q(`delete from recruiters where id=$1 and created_by='user'`, [z.string().uuid().parse(recruiterId)]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Jobs & applications
// ---------------------------------------------------------------------------

const JobSchema = z.object({
  company_id: z.string().uuid(),
  title: str(200).min(2),
  requisition_id: optStr(60),
  location: optStr(200),
  employment_type: z.enum(["internship", "co_op", "full_time", "part_time", "research", "development_program", "other"]),
  description: optStr(8000),
  qualifications: optStr(4000),
  apply_url: optUrl,
  deadline: optDate,
  salary: optStr(120),
  citizenship_required: z.enum(["yes", "no", "unknown"]).default("unknown"),
  us_person_required: z.enum(["yes", "no", "unknown"]).default("unknown"),
  clearance_required: z.enum(["yes", "no", "unknown"]).default("unknown"),
  sponsorship: z.enum(["offered", "not_offered", "unknown"]).default("unknown"),
  eligibility_note: optStr(1000),
});

const tri = (v: "yes" | "no" | "unknown") => (v === "yes" ? true : v === "no" ? false : null);

export async function addJob(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const d = JobSchema.parse(form(fd));
    let sourceId: string | null = null;
    if (d.apply_url) {
      const s = await q1<{ id: string }>(
        `insert into sources (url, title, source_type, accessed_at) values ($1,$2,'user_provided', current_date)
         on conflict (url) do update set accessed_at=current_date returning id`, [d.apply_url, d.title]);
      sourceId = s?.id ?? null;
    }
    const [job] = await q<{ id: string }>(
      `insert into jobs (company_id, title, requisition_id, location, employment_type, description, qualifications, skills, salary,
         deadline, apply_url, listing_status, verification, source_id, last_checked_at, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,'{}',$8,$9,$10,'open',$11,$12,current_date,'user')
       on conflict (company_id, title, requisition_id) do update set location=excluded.location, description=excluded.description
       returning id`,
      [d.company_id, d.title, d.requisition_id ?? "", d.location, d.employment_type, d.description,
        (d.qualifications ?? "").split(/\n+/).map((s) => s.trim()).filter(Boolean), d.salary, d.deadline, d.apply_url,
        d.apply_url ? "partially_verified" : "unverified", sourceId],
    );
    await q(
      `insert into job_eligibility (job_id, citizenship_required, us_person_required, clearance_required, sponsorship, note, evidence, source_id)
       values ($1,$2,$3,$4,$5,$6,'Entered by user from the posting',$7)
       on conflict (job_id) do update set citizenship_required=excluded.citizenship_required, us_person_required=excluded.us_person_required,
         clearance_required=excluded.clearance_required, sponsorship=excluded.sponsorship, note=excluded.note`,
      [job.id, tri(d.citizenship_required), tri(d.us_person_required), tri(d.clearance_required), d.sponsorship, d.eligibility_note, sourceId],
    );
    await q(`insert into applications (user_id, job_id, company_id, title, url, status) values ($1,$2,$3,$4,$5,'saved') on conflict do nothing`,
      [userId, job.id, d.company_id, d.title, d.apply_url]);
    refresh();
    return { ok: true, message: "Job saved to your tracker" };
  } catch (e) {
    return fail(e);
  }
}

export async function setJobListingStatus(jobId: string, status: "open" | "closed" | "unknown"): Promise<ActionResult> {
  try {
    await requireUserId();
    await q(`update jobs set listing_status=$2, last_checked_at=current_date where id=$1`, [z.string().uuid().parse(jobId), z.enum(["open", "closed", "unknown"]).parse(status)]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveJobToTracker(jobId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const job = await q1<{ id: string; company_id: string; title: string; apply_url: string | null }>(`select id, company_id, title, apply_url from jobs where id=$1`, [z.string().uuid().parse(jobId)]);
    if (!job) throw new Error("Job not found");
    await q(`insert into applications (user_id, job_id, company_id, title, url, status) values ($1,$2,$3,$4,$5,'saved') on conflict do nothing`,
      [userId, job.id, job.company_id, job.title, job.apply_url]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateApplication(id: string, patch: { status?: string; notes?: string; applied_at?: string }): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const p = z.object({ status: z.enum(APPLICATION_STATUSES).optional(), notes: z.string().max(5000).optional(), applied_at: optDate }).parse(patch);
    await q(
      `update applications set status=coalesce($3,status), notes=coalesce($4,notes),
         applied_at=coalesce($5::date, case when $3='applied' and applied_at is null then current_date else applied_at end), updated_at=now()
       where id=$1 and user_id=$2`,
      [z.string().uuid().parse(id), userId, p.status ?? null, p.notes ?? null, p.applied_at ?? null],
    );
    if (p.status === "applied" || p.status === "interviewing" || p.status === "offer") {
      const map = { applied: "applied", interviewing: "interview_scheduled", offer: "offer_received" } as const;
      await q(`insert into company_tracking (user_id, company_id, status) select $1, company_id, $3 from applications where id=$2
               on conflict (user_id, company_id) do update set status=excluded.status, updated_at=now()`, [userId, id, map[p.status]]);
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteApplication(id: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await q(`delete from applications where id=$1 and user_id=$2`, [z.string().uuid().parse(id), userId]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Outreach drafts
// ---------------------------------------------------------------------------

export async function saveDraft(input: { company_id?: string | null; recruiter_id?: string | null; job_id?: string | null; kind: string; body: string; generated_by: "template" | "ai" | "user" }): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const d = z.object({
      company_id: z.string().uuid().nullable().optional(),
      recruiter_id: z.string().uuid().nullable().optional(),
      job_id: z.string().uuid().nullable().optional(),
      kind: z.string().min(1).max(60),
      body: z.string().min(1).max(8000),
      generated_by: z.enum(["template", "ai", "user"]),
    }).parse(input);
    await q(`insert into outreach_drafts (user_id, company_id, recruiter_id, job_id, kind, body, generated_by) values ($1,$2,$3,$4,$5,$6,$7)`,
      [userId, d.company_id ?? null, d.recruiter_id ?? null, d.job_id ?? null, d.kind, d.body, d.generated_by]);
    refresh();
    return { ok: true, message: "Draft saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDraft(id: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await q(`delete from outreach_drafts where id=$1 and user_id=$2`, [z.string().uuid().parse(id), userId]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Profile & preferences
// ---------------------------------------------------------------------------

const PrefsSchema = z.object({
  citizenship: z.enum(["us_citizen", "permanent_resident", "non_us_citizen", "prefer_not"]),
  usPerson: z.enum(["yes", "no", "unknown"]),
  workAuthorization: str(200),
  sponsorship: z.enum(["needs_now", "needs_future", "not_needed", "unknown"]),
  clearance: z.enum(["yes", "no", "unknown"]),
  degreeLevel: z.enum(["bachelors", "masters", "phd"]),
  graduation: str(20),
  locations: z.array(str(80)).max(20),
  openToRelocate: z.boolean(),
  employmentTypes: z.array(z.string()).max(10),
  industries: z.array(z.string()).max(20),
  goals: str(2000),
});

export async function savePreferences(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const f = form(fd);
    const prefs = PrefsSchema.parse({
      ...f,
      locations: (f.locations ?? "").split(/[\n;]+/).map((s) => s.trim()).filter(Boolean),
      openToRelocate: f.openToRelocate === "on",
      employmentTypes: fd.getAll("employmentTypes").map(String),
      industries: (f.industries ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
    }) as Preferences;
    const profile = await getProfile(userId);
    await saveProfile(userId, profile.data, prefs);
    refresh();
    return { ok: true, message: "Preferences saved. Rankings and eligibility have been recalculated." };
  } catch (e) {
    return fail(e);
  }
}

const ProfileSchema = z.object({
  fullName: str(120).min(1),
  headline: str(300).optional(),
  location: str(120).optional(),
  linkedinUrl: z.string().trim().regex(/^https:\/\/([a-z]+\.)?linkedin\.com\/.*/).or(z.literal("")).optional(),
  email: z.string().email().or(z.literal("")).optional(),
  phone: str(40).optional(),
  summary: str(4000).optional(),
  education: z.array(z.object({ school: str(200), degree: str(200), minor: str(200).optional(), expectedGraduation: str(40).optional(), honors: z.array(str(300)).optional() })).max(10),
  experience: z.array(z.object({ org: str(200), role: str(300), location: str(120).optional(), start: str(20).optional(), end: str(20).optional(), bullets: z.array(str(1000)).max(10) })).max(30),
  research: z.array(z.object({ title: str(400), org: str(300).optional(), question: str(1000).optional(), methods: z.array(str(500)).max(20), keyFindings: z.array(str(500)).max(20), nextSteps: z.array(str(500)).optional(), collaborators: z.array(str(200)).optional() })).max(10),
  projects: z.array(z.object({ name: str(200), bullets: z.array(str(1000)).max(10) })).max(30),
  publications: z.array(z.object({ title: str(400), venue: str(200).optional(), role: str(100).optional() })).max(50),
  leadership: z.array(z.object({ org: str(200), role: str(200), bullets: z.array(str(1000)).max(10) })).max(20),
  skillGroups: z.array(z.object({ name: str(100), items: z.array(str(100)).max(50) })).max(20),
  certifications: z.array(str(200)).max(30),
  affiliations: z.array(str(200)).max(30),
});

export async function saveProfileJson(json: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const data = ProfileSchema.parse(JSON.parse(json)) as ProfileData;
    const profile = await getProfile(userId);
    await saveProfile(userId, data, profile.preferences);
    refresh();
    return { ok: true, message: "Profile approved and saved. Rankings have been recalculated." };
  } catch (e) {
    if (e instanceof SyntaxError) return { ok: false, error: "Invalid JSON" };
    return fail(e);
  }
}

/** Merge user-approved suggestions extracted from an uploaded document. */
export async function applyDocumentSuggestions(docId: string, picks: { skills: string[]; publications: string[]; experience: number[]; summary?: string }): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const doc = await q1<{ analysis: { suggestions?: { experience?: { org: string; role: string; bullets: string[] }[] } } | null }>(
      `select analysis from documents where id=$1 and user_id=$2`, [z.string().uuid().parse(docId), userId]);
    if (!doc) throw new Error("Document not found");
    const profile = await getProfile(userId);
    const data = structuredClone(profile.data);
    const existingSkills = new Set(data.skillGroups.flatMap((g) => g.items.map((i) => i.toLowerCase())));
    const newSkills = picks.skills.map((s) => s.trim()).filter((s) => s && !existingSkills.has(s.toLowerCase()));
    if (newSkills.length) {
      const g = data.skillGroups.find((x) => x.name === "Imported skills");
      if (g) g.items.push(...newSkills);
      else data.skillGroups.push({ name: "Imported skills", items: newSkills });
    }
    const pubTitles = new Set(data.publications.map((p) => p.title.toLowerCase()));
    for (const t of picks.publications) if (!pubTitles.has(t.toLowerCase())) data.publications.push({ title: t });
    const exp = doc.analysis?.suggestions?.experience ?? [];
    for (const i of picks.experience) if (exp[i]) data.experience.push({ ...exp[i], bullets: exp[i].bullets ?? [] });
    if (picks.summary) data.summary = picks.summary;
    await saveProfile(userId, data, profile.preferences);
    await q(`update documents set review_status='applied' where id=$1 and user_id=$2`, [docId, userId]);
    refresh();
    return { ok: true, message: "Approved items added to your profile" };
  } catch (e) {
    return fail(e);
  }
}

export async function dismissDocumentSuggestions(docId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await q(`update documents set review_status='dismissed' where id=$1 and user_id=$2`, [z.string().uuid().parse(docId), userId]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Privacy controls
// ---------------------------------------------------------------------------

export async function disconnectLinkedIn(): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await q(`delete from linkedin_connections where user_id=$1`, [userId]);
    refresh();
    return { ok: true, message: "LinkedIn disconnected and the stored token deleted. You can also revoke access at linkedin.com/psettings/permitted-services." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteMyData(scope: "networking" | "documents" | "everything"): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    if (scope === "documents" || scope === "everything") await q(`delete from documents where user_id=$1`, [userId]);
    if (scope === "networking" || scope === "everything") {
      for (const t of ["interactions", "tasks", "notes", "outreach_drafts", "applications", "company_tracking", "recruiter_contacts", "chat_threads"]) {
        await q(`delete from ${t} where user_id=$1`, [userId]);
      }
      await q(`delete from recruiters where created_by='user'`);
    }
    if (scope === "everything") {
      await q(`delete from linkedin_connections where user_id=$1`, [userId]);
      await q(`delete from compatibility_assessments where user_id=$1`, [userId]);
      await q(
        `update professional_profiles set data=$2, version=version+1, updated_at=now() where user_id=$1`,
        [userId, JSON.stringify({ fullName: "", education: [], experience: [], research: [], projects: [], publications: [], leadership: [], skillGroups: [], certifications: [], affiliations: [] })],
      );
    }
    refresh();
    return { ok: true, message: "Deleted." };
  } catch (e) {
    return fail(e);
  }
}
