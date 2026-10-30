import { detectDomains, DOMAIN_BY_KEY, type DomainKey } from "./taxonomy";
import type { ProfileIntel } from "./intel";
import type { Company, Job, Participation, Preferences } from "./types";
import { assessCompany, assessJob, type CompanyEligibility } from "./eligibility";

// Explainable company-compatibility engine. Weights come from the brief:
// technical 30 · research 25 · opportunities 20 · industry 15 · networking 10.

export const WEIGHTS = {
  technical: 30,
  research: 25,
  opportunities: 20,
  industry: 15,
  networking: 10,
} as const;
export type FactorKey = keyof typeof WEIGHTS;

export const FACTOR_LABEL: Record<FactorKey, string> = {
  technical: "Technical skill alignment",
  research: "Research & project relevance",
  opportunities: "Relevant career opportunities",
  industry: "Industry interests & career growth",
  networking: "Networking potential",
};

export interface FactorResult {
  key: FactorKey;
  weight: number;
  score: number; // 0–100
  evidence: string[];
  gaps: string[];
}

export interface JobMatch {
  jobId: string;
  score: number;
  matched: string[];
  missing: string[];
}

export interface Assessment {
  companyId: string;
  score: number;
  confidence: "high" | "medium" | "low";
  confidenceReasons: string[];
  factors: FactorResult[];
  matchedDomains: { key: DomainKey; label: string; context: string; strength: number; evidence: string }[];
  missingQualifications: string[];
  evidenceGaps: string[];
  priority: { tier: 1 | 2 | 3 | 4; label: string };
  jobMatches: JobMatch[];
  eligibility: CompanyEligibility;
}

export interface ScoringInput {
  company: Company;
  participation: Participation[];
  jobs: Job[];
  recruiterCount: number;
  interactionCount: number;
  intel: ProfileIntel;
  prefs: Preferences;
}

function overlap(
  tags: Company["tech_tags"],
  strengths: ProfileIntel["skills"],
) {
  let total = 0;
  let got = 0;
  const matched: Assessment["matchedDomains"] = [];
  const weak: { key: DomainKey; context: string; weight: number }[] = [];
  for (const [k, tag] of Object.entries(tags) as [DomainKey, { weight: number; context: string }][]) {
    total += tag.weight;
    const s = strengths.get(k);
    const strength = s?.strength ?? 0;
    got += tag.weight * strength;
    if (strength >= 0.2 && s) {
      matched.push({ key: k, label: DOMAIN_BY_KEY[k].label, context: tag.context, strength, evidence: s.evidence[0]?.label ?? "" });
    } else if (tag.weight >= 2) {
      weak.push({ key: k, context: tag.context, weight: tag.weight });
    }
  }
  matched.sort((a, b) => (tags[b.key]!.weight * b.strength) - (tags[a.key]!.weight * a.strength));
  return { ratio: total ? got / total : 0, matched, weak, total };
}

export function matchJob(job: Job, intel: ProfileIntel, prefs: Preferences): JobMatch {
  const text = [job.title, job.description, ...job.qualifications, ...job.skills].join(" ");
  const domains = detectDomains(text);
  const matched: string[] = [];
  const missing: string[] = [];
  let have = 0;
  for (const [k] of domains) {
    const s = intel.skills.get(k)?.strength ?? 0;
    if (s >= 0.3) { matched.push(DOMAIN_BY_KEY[k].label); have += 1; }
    else missing.push(DOMAIN_BY_KEY[k].label);
  }
  const domainScore = domains.size ? have / domains.size : 0.3;
  const typeOk = prefs.employmentTypes.length === 0 || prefs.employmentTypes.includes(job.employment_type);
  // Qualification lines the profile cannot be checked against (GPA, degree)
  // are surfaced so the user can confirm them by hand.
  for (const q of job.qualifications) {
    if (/gpa/i.test(q)) missing.push(`Confirm: ${q}`);
  }
  const score = Math.round(100 * (0.8 * domainScore + (typeOk ? 0.2 : 0)));
  return { jobId: job.id, score, matched, missing };
}

const PARTICIPATION_POINTS: Record<string, number> = {
  "verified:exhibitor": 85,
  "verified:sponsor": 85,
  "verified:event_partner": 70,
  "partially_verified:exhibitor": 60,
  "partially_verified:event_partner": 50,
  "partially_verified:academic_partner": 50,
  "partially_verified:ipc_partner": 45,
  "verified:ipc_partner": 50,
};

export function scoreCompany(input: ScoringInput): Assessment {
  const { company, participation, jobs, recruiterCount, interactionCount, intel, prefs } = input;
  const evidenceGaps: string[] = [];
  const factors: FactorResult[] = [];

  // 1 · Technical skill alignment
  const tech = overlap(company.tech_tags, intel.skills);
  const techScore = tech.total ? Math.min(100, Math.round(100 * Math.min(1, tech.ratio * 1.35))) : 0;
  if (!tech.total) evidenceGaps.push("No engineering-domain data recorded for this company.");
  factors.push({
    key: "technical",
    weight: WEIGHTS.technical,
    score: techScore,
    evidence: tech.matched.slice(0, 5).map((m) => `${m.label}: ${m.evidence} ↔ ${m.context}`),
    gaps: tech.weak.slice(0, 4).map((w) => `Little evidence of ${DOMAIN_BY_KEY[w.key].label.toLowerCase()} (${w.context})`),
  });

  // 2 · Research & project relevance
  const res = overlap(company.tech_tags, intel.research);
  const resScore = res.total ? Math.min(100, Math.round(100 * Math.min(1, res.ratio * 1.5))) : 0;
  factors.push({
    key: "research",
    weight: WEIGHTS.research,
    score: resScore,
    evidence: res.matched.slice(0, 4).map((m) => `${m.evidence} → ${m.context}`),
    gaps: res.matched.length ? [] : ["Your research and projects don't map onto this company's documented engineering areas."],
  });

  // 3 · Relevant career opportunities
  const openJobs = jobs.filter((j) => j.listing_status !== "closed");
  const jobMatches = openJobs.map((j) => matchJob(j, intel, prefs)).sort((a, b) => b.score - a.score);
  let oppScore: number;
  const oppEvidence: string[] = [];
  const oppGaps: string[] = [];
  if (jobMatches.length) {
    const best = jobMatches[0];
    const bestJob = openJobs.find((j) => j.id === best.jobId)!;
    const elig = assessJob(bestJob.eligibility, prefs);
    oppScore = Math.round(40 + 0.6 * best.score);
    if (elig.status === "explicit_restriction") {
      oppScore = Math.round(oppScore * 0.5);
      oppGaps.push(`Best-matching posting "${bestJob.title}" has an explicit eligibility restriction for your settings.`);
    }
    oppEvidence.push(`${openJobs.length} posting(s) on file; best match "${bestJob.title}" (${best.score}/100)`);
    if (best.matched.length) oppEvidence.push(`Matches: ${best.matched.slice(0, 4).join(", ")}`);
    if (openJobs.some((j) => j.verification !== "verified")) oppGaps.push("Posting status is not re-verified. Confirm it is still open.");
  } else {
    const programs = company.engineering_areas.filter((a) => /intern|co-?op|program|development/i.test(a));
    oppScore = programs.length ? 35 : 25;
    if (programs.length) oppEvidence.push(`Known early-career programs: ${programs.join("; ")}`);
    oppGaps.push("No verified job postings on file. Check the careers site or ask at the booth.");
    evidenceGaps.push("No verified job postings on file.");
  }
  factors.push({ key: "opportunities", weight: WEIGHTS.opportunities, score: Math.min(100, oppScore), evidence: oppEvidence, gaps: oppGaps });

  // 4 · Industry interests & growth
  const prefIdx = company.industries
    .map((ind) => prefs.industries.indexOf(ind))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);
  let indScore = 10;
  const indEvidence: string[] = [];
  if (prefIdx.length) {
    indScore = Math.max(35, 100 - prefIdx[0] * 8) + Math.min(15, (prefIdx.length - 1) * 5);
    indEvidence.push(`Matches your interests: ${company.industries.filter((i) => prefs.industries.includes(i)).join(", ")}`);
  }
  factors.push({
    key: "industry",
    weight: WEIGHTS.industry,
    score: Math.min(100, indScore),
    evidence: indEvidence,
    gaps: prefIdx.length ? [] : [`${company.industry} is not among your preferred industries.`],
  });

  // 5 · Networking potential
  const y2026 = participation.filter((p) => p.event_year === 2026);
  let netScore = 15;
  const netEvidence: string[] = [];
  const netGaps: string[] = [];
  for (const p of y2026) {
    const pts = PARTICIPATION_POINTS[`${p.verification}:${p.role}`] ?? (p.verification === "unverified" ? 15 : 35);
    if (pts > netScore) netScore = pts;
  }
  const booth = y2026.find((p) => p.booth_number);
  if (booth) { netScore = Math.max(netScore, 95); netEvidence.push(`Published booth #${booth.booth_number}`); }
  const best = y2026.sort((a, b) => (a.verification === "verified" ? -1 : 1) - (b.verification === "verified" ? -1 : 1))[0];
  if (best) netEvidence.push(`SHPE 2026: ${best.role.replace("_", " ")}${best.tier ? ` (${best.tier})` : ""} — ${best.verification.replace("_", " ")}`);
  else { netGaps.push("2026 convention participation not confirmed."); evidenceGaps.push("SHPE 2026 participation unconfirmed."); }
  if (recruiterCount) { netScore += Math.min(10, recruiterCount * 5); netEvidence.push(`${recruiterCount} recruiter/contact(s) on file`); }
  else netGaps.push("No recruiters identified yet. Use the LinkedIn search link to find university recruiters.");
  if (interactionCount) { netScore += 5; netEvidence.push(`${interactionCount} logged interaction(s)`); }
  if (!booth && best) netGaps.push("Booth number not published. Check the official floor plan in the SHPE app.");
  factors.push({ key: "networking", weight: WEIGHTS.networking, score: Math.min(100, netScore), evidence: netEvidence, gaps: netGaps });

  const score = Math.round(factors.reduce((acc, f) => acc + (f.weight * f.score) / 100, 0));

  // Confidence reflects how much of the score rests on verified data.
  let conf = 0;
  const confidenceReasons: string[] = [];
  if (y2026.some((p) => p.verification === "verified")) { conf += 2; confidenceReasons.push("Participation verified by an official source"); }
  else if (y2026.some((p) => p.verification === "partially_verified")) { conf += 1; confidenceReasons.push("Participation only partially verified"); }
  else confidenceReasons.push("Participation unverified");
  if (company.profile_verification === "verified") conf += 2;
  else if (company.profile_verification === "partially_verified") { conf += 1; confidenceReasons.push("Company engineering profile compiled from public info, not re-verified"); }
  if (jobs.length) { conf += 1; confidenceReasons.push("Job postings on file"); } else confidenceReasons.push("No job postings on file");
  if (intel.completeness.score >= 80) conf += 1;
  const confidence = conf >= 5 ? "high" : conf >= 3 ? "medium" : "low";

  const priority: Assessment["priority"] =
    score >= 68 && factors[4].score >= 80 ? { tier: 1, label: "Tier 1 — visit first" }
    : score >= 55 ? { tier: 2, label: "Tier 2 — strong match" }
    : score >= 40 ? { tier: 3, label: "Tier 3 — if time allows" }
    : { tier: 4, label: "Low priority" };

  const missingQualifications = [
    ...tech.weak.slice(0, 3).map((w) => `${DOMAIN_BY_KEY[w.key].label} (${w.context})`),
    ...(jobMatches[0]?.missing ?? []).slice(0, 3),
  ];

  return {
    companyId: company.id,
    score,
    confidence,
    confidenceReasons,
    factors,
    matchedDomains: tech.matched,
    missingQualifications,
    evidenceGaps,
    priority,
    jobMatches,
    eligibility: assessCompany(company, jobs, prefs),
  };
}
