import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeProfile } from "../src/lib/intel";
import { scoreCompany, WEIGHTS } from "../src/lib/scoring";
import { assessJob } from "../src/lib/eligibility";
import { buildMessage, buildPrep } from "../src/lib/coach";
import { csvToDataset, DatasetSchema } from "../src/lib/dataset";
import { detectDomains } from "../src/lib/taxonomy";
import type { Company, Job, Participation, Preferences, ProfileData } from "../src/lib/types";
import seed from "../data/profile.seed.json";
import dataset from "../data/shpe2026-dataset.json";

const profile = seed.data as unknown as ProfileData;
const prefs = seed.preferences as Preferences;

function company(slug: string): Company {
  const c = dataset.companies.find((x) => x.slug === slug)!;
  return {
    id: slug, slug, name: c.name, industry: c.industry, industries: c.industries, headquarters: c.headquarters, website: c.website,
    domain: c.domain, careers_url: (c as { careers_url?: string }).careers_url ?? null, linkedin_url: null, description: c.description,
    size: c.size, presence: c.presence, products: c.products,
    tech_tags: Object.fromEntries(Object.entries(c.tags).map(([k, [w, ctx]]) => [k, { weight: w as number, context: ctx as string }])),
    engineering_areas: c.engineering_areas, recent_developments: [], technical_challenges: c.technical_challenges ?? [],
    eligibility_notes: (c as { eligibility_notes?: string }).eligibility_notes ?? null, profile_verification: "partially_verified",
    last_verified_at: "2026-10-30", created_by: "seed",
  };
}

const part = (verification: Participation["verification"], role = "exhibitor", booth: string | null = null): Participation => ({
  id: "p", company_id: "x", event_year: 2026, role, tier: null, booth_number: booth, booth_location: null, activities: [], verification,
  evidence: "test", verified_at: "2026-10-30", source_url: null, source_title: null, source_type: null, access_note: null,
});

test("weights sum to 100", () => {
  assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
});

test("profile analysis finds the GRX-810 / LPBF research as a top strength", () => {
  const intel = analyzeProfile(profile);
  const keys = intel.topStrengths.map((s) => s.key);
  assert.ok(keys.includes("lpbf") || keys.includes("additive_manufacturing"));
  assert.ok((intel.research.get("superalloys_high_temp")?.strength ?? 0) > 0.5);
});

test("short acronyms match whole words only", () => {
  assert.ok(!detectDomains("relationship building").has("heat_treatment_hip"));
  assert.ok(detectDomains("after HIP at 1163 C").has("heat_treatment_hip"));
});

test("an aerospace AM company outranks a bank, with explainable evidence", () => {
  const intel = analyzeProfile(profile);
  const ge = scoreCompany({ company: company("ge-aerospace"), participation: [part("verified")], jobs: [], recruiterCount: 0, interactionCount: 0, intel, prefs });
  const bank = scoreCompany({ company: company("bank-of-america"), participation: [part("verified", "sponsor")], jobs: [], recruiterCount: 0, interactionCount: 0, intel, prefs });
  assert.ok(ge.score > bank.score + 30, `${ge.score} vs ${bank.score}`);
  assert.ok(ge.factors[0].evidence.length > 0);
  assert.equal(ge.factors.length, 5);
  assert.ok(ge.evidenceGaps.some((g) => /job postings/i.test(g)));
});

test("unverified participation lowers networking and confidence", () => {
  const intel = analyzeProfile(profile);
  const a = scoreCompany({ company: company("boeing"), participation: [part("unverified", "historical")], jobs: [], recruiterCount: 0, interactionCount: 0, intel, prefs });
  assert.equal(a.confidence, "low");
  assert.ok(a.factors.find((f) => f.key === "networking")!.score <= 20);
});

test("eligibility never assumes authorization", () => {
  const usPerson = { citizenship_required: null, us_person_required: true, clearance_required: null, sponsorship: "not_offered" as const, note: null, evidence: null };
  assert.equal(assessJob(usPerson, prefs).status, "requires_clarification");
  assert.equal(assessJob(usPerson, { ...prefs, usPerson: "no", sponsorship: "needs_future" }).status, "explicit_restriction");
  assert.equal(assessJob(usPerson, { ...prefs, citizenship: "permanent_resident", sponsorship: "not_needed" }).status, "confirmed_eligible");
  assert.equal(assessJob(null, prefs).status, "insufficient_information");
  const silent = { citizenship_required: null, us_person_required: null, clearance_required: null, sponsorship: "unknown" as const, note: null, evidence: null };
  assert.equal(assessJob(silent, prefs).status, "insufficient_information");
  const clearance = { ...silent, clearance_required: true };
  assert.equal(assessJob(clearance, prefs).status, "explicit_restriction");
});

test("prep and messages only use facts from the profile", () => {
  const intel = analyzeProfile(profile);
  const c = company("ge-aerospace");
  const a = scoreCompany({ company: c, participation: [part("verified")], jobs: [], recruiterCount: 0, interactionCount: 0, intel, prefs });
  const prep = buildPrep(c, a, profile, prefs, []);
  assert.match(prep.pitch30, /GRX-810|powder bed/);
  assert.ok(prep.questions.length >= 5 && prep.questions.length <= 10);
  assert.match(prep.hardQuestions.find((h) => /authorized/.test(h.q))!.a, /not a U\.S\. citizen/);
  const conn = buildMessage({ kind: "connection", profile, company: c });
  assert.ok(conn.length <= 300);
  const fu = buildMessage({ kind: "post_convention", profile, company: c, conversationNotes: "LPBF process qualification" });
  assert.match(fu, /LPBF process qualification/);
  // Removing the research from the profile removes research-based claims.
  const stripped = { ...profile, research: [], publications: [], experience: [], projects: [] };
  const intel2 = analyzeProfile(stripped);
  const a2 = scoreCompany({ company: c, participation: [part("verified")], jobs: [], recruiterCount: 0, interactionCount: 0, intel: intel2, prefs });
  assert.doesNotMatch(buildPrep(c, a2, stripped, prefs, []).pitch60, /884\.6/);
});

test("job match flags GPA requirements for manual confirmation", () => {
  const intel = analyzeProfile(profile);
  const job = { id: "j", company_id: "ge", title: "Manufacturing Engineering Intern", qualifications: ["Minimum 3.0 cumulative GPA"], skills: ["manufacturing engineering"], description: "assembly", employment_type: "internship" } as unknown as Job;
  const a = scoreCompany({ company: company("ge-aerospace"), participation: [part("verified")], jobs: [{ ...job, eligibility: null, listing_status: "unknown", verification: "verified" } as Job], recruiterCount: 0, interactionCount: 0, intel, prefs });
  assert.ok(a.jobMatches[0].missing.some((m) => /GPA/.test(m)));
});

test("bundled dataset validates and every participation record cites a source", () => {
  const ds = DatasetSchema.parse(dataset);
  const keys = new Set(ds.sources.map((s) => s.key));
  for (const c of ds.companies) for (const p of c.participation) assert.ok(p.source && keys.has(p.source), `${c.slug} missing source`);
  assert.equal(ds.recruiters.length, 0, "no recruiters are seeded without verified evidence");
});

test("CSV import parses quoted fields", () => {
  const ds = csvToDataset('name,industry,verification,evidence,booth_number\n"Acme, Inc.",Aerospace & Defense,verified,"Listed on ""official"" page",42\n');
  assert.equal(ds.companies[0].name, "Acme, Inc.");
  assert.equal(ds.companies[0].participation[0].booth_number, "42");
  assert.equal(ds.companies[0].participation[0].evidence, 'Listed on "official" page');
});
