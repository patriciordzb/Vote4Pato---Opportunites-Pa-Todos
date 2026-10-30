import type { Company, Job, JobEligibility, Preferences } from "./types";

// Employment-eligibility assessment, kept deliberately separate from the
// compatibility score. It only compares the user's own settings with
// requirements a posting states explicitly. It never infers authorization.

export type EligibilityStatus =
  | "confirmed_eligible"
  | "potentially_eligible"
  | "requires_clarification"
  | "explicit_restriction"
  | "insufficient_information";

export const ELIGIBILITY_LABEL: Record<EligibilityStatus, string> = {
  confirmed_eligible: "Confirmed eligible",
  potentially_eligible: "Potentially eligible",
  requires_clarification: "Eligibility requires clarification",
  explicit_restriction: "Explicit restriction identified",
  insufficient_information: "Insufficient information",
};

export interface JobEligibilityResult {
  status: EligibilityStatus;
  reasons: string[];
  requirements: string[];
}

type Check = "ok" | "restricted" | "clarify";

export function assessJob(e: JobEligibility | null, p: Preferences): JobEligibilityResult {
  const requirements: string[] = [];
  const reasons: string[] = [];
  const checks: Check[] = [];
  if (!e) return { status: "insufficient_information", reasons: ["No work-authorization information recorded for this posting."], requirements };

  const isCitizen = p.citizenship === "us_citizen";
  const isUsPerson = isCitizen || p.citizenship === "permanent_resident" || p.usPerson === "yes";
  const notUsPerson = p.usPerson === "no" && !isCitizen && p.citizenship !== "permanent_resident";

  if (e.citizenship_required) {
    requirements.push("U.S. citizenship required");
    if (isCitizen) { checks.push("ok"); reasons.push("Posting requires U.S. citizenship; your settings say U.S. citizen."); }
    else if (p.citizenship === "prefer_not") { checks.push("clarify"); reasons.push("Posting requires U.S. citizenship; your citizenship is not set."); }
    else { checks.push("restricted"); reasons.push("Posting explicitly requires U.S. citizenship."); }
  }
  if (e.us_person_required) {
    requirements.push("U.S. person required (citizen, permanent resident, asylee or refugee)");
    if (isUsPerson) { checks.push("ok"); reasons.push("Posting requires U.S. person status; your settings indicate you qualify."); }
    else if (notUsPerson) { checks.push("restricted"); reasons.push("Posting requires U.S. person status (export control); your settings say you are not a U.S. person."); }
    else { checks.push("clarify"); reasons.push("Posting requires U.S. person status. Set whether you are a U.S. person (permanent residents, asylees and refugees also qualify) in Settings."); }
  }
  if (e.clearance_required) {
    requirements.push("Security clearance required");
    if (!isCitizen && p.citizenship !== "prefer_not") { checks.push("restricted"); reasons.push("Posting requires a security clearance; U.S. clearances generally require U.S. citizenship."); }
    else if (p.clearance === "yes") checks.push("ok");
    else { checks.push("clarify"); reasons.push("Posting requires a security clearance; confirm eligibility."); }
  }
  if (e.sponsorship === "not_offered") {
    requirements.push("Visa sponsorship not offered");
    if (p.sponsorship === "needs_now" || p.sponsorship === "needs_future") { checks.push("restricted"); reasons.push("Posting states sponsorship is not available, and your settings say you need sponsorship."); }
    else if (p.sponsorship === "not_needed") { checks.push("ok"); reasons.push("No sponsorship offered; your settings say you don't need it."); }
    else { checks.push("clarify"); reasons.push("Posting states sponsorship is not available. Set whether you will need sponsorship in Settings."); }
  }
  if (e.sponsorship === "offered") {
    requirements.push("Visa sponsorship offered");
    checks.push("ok");
    reasons.push("Posting explicitly offers sponsorship.");
  }
  if (e.note) reasons.push(e.note);

  if (checks.length === 0) return { status: "insufficient_information", reasons: reasons.length ? reasons : ["Posting does not state work-authorization requirements."], requirements };
  if (checks.includes("restricted")) return { status: "explicit_restriction", reasons, requirements };
  if (checks.includes("clarify")) return { status: "requires_clarification", reasons, requirements };
  // All explicit checks pass. "Confirmed" also needs the user's own
  // authorization to be recorded, otherwise it stays "potentially".
  const userDeclared = p.citizenship !== "prefer_not" && (p.sponsorship !== "unknown" || isCitizen);
  return { status: userDeclared ? "confirmed_eligible" : "potentially_eligible", reasons, requirements };
}

export interface CompanyEligibility {
  status: EligibilityStatus;
  summary: string;
  jobs: { jobId: string; title: string; result: JobEligibilityResult }[];
  notes: string[];
}

const RANK: EligibilityStatus[] = ["confirmed_eligible", "potentially_eligible", "requires_clarification", "insufficient_information", "explicit_restriction"];

export function assessCompany(company: Pick<Company, "eligibility_notes" | "name">, jobs: Job[], p: Preferences): CompanyEligibility {
  const results = jobs.map((j) => ({ jobId: j.id, title: j.title, result: assessJob(j.eligibility, p) }));
  const notes: string[] = [];
  if (company.eligibility_notes) notes.push(company.eligibility_notes);
  if (!results.length) {
    return {
      status: "insufficient_information",
      summary: `No postings with eligibility details are on file for ${company.name}. Ask the recruiter which roles are open to your work-authorization situation.`,
      jobs: [],
      notes,
    };
  }
  const best = [...results].sort((a, b) => RANK.indexOf(a.result.status) - RANK.indexOf(b.result.status))[0];
  const restricted = results.filter((r) => r.result.status === "explicit_restriction").length;
  let summary = `${results.length} posting(s) assessed. The most favorable is "${best.title}": ${best.result.status.replace(/_/g, " ")}.`;
  if (restricted) {
    summary += ` ${restricted} posting(s) have an explicit restriction. That applies to those roles only, not to the whole company.`;
  }
  return { status: best.result.status, summary, jobs: results, notes };
}
