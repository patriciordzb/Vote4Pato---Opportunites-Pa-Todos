import "server-only";
import { q } from "./db";
import { profileToText } from "./intel";
import { bestParticipation, boothOf, listApplications, listTasks, type Workspace } from "./repo";
import { ELIGIBILITY_LABEL } from "./eligibility";
import { CRM_LABEL, type Preferences } from "./types";
import { DOMAIN_BY_KEY } from "./taxonomy";

export function prefsText(p: Preferences) {
  const cit = { us_citizen: "U.S. citizen", permanent_resident: "U.S. permanent resident", non_us_citizen: "Not a U.S. citizen", prefer_not: "Not specified" }[p.citizenship];
  return `Citizenship: ${cit}. U.S. person: ${p.usPerson}. Current work authorization: ${p.workAuthorization || "not specified"}. Sponsorship need: ${p.sponsorship}. Degree: ${p.degreeLevel}, graduating ${p.graduation}. Preferred industries (ranked): ${p.industries.join(", ")}. Employment types: ${p.employmentTypes.join(", ")}. Locations: ${p.locations.join(", ") || "open"}${p.openToRelocate ? " (open to relocate)" : ""}. Goals: ${p.goals}`;
}

/** Compact, citation-friendly snapshot of the user's database for the AI assistant. */
export async function buildGroundingContext(ws: Workspace, focusCompanyId?: string): Promise<string> {
  const [tasks, apps, notes] = await Promise.all([
    listTasks(ws.userId),
    listApplications(ws.userId),
    q<{ entity_id: string | null; body: string }>(`select entity_id, body from notes where user_id=$1 order by created_at desc limit 40`, [ws.userId]),
  ]);
  const ranked = [...ws.companies].sort((a, b) => (ws.assessments.get(b.id)?.score ?? 0) - (ws.assessments.get(a.id)?.score ?? 0));
  const lines: string[] = [];
  lines.push("## USER PROFILE (approved by user)");
  lines.push(profileToText(ws.profile.data));
  lines.push(`Settings: ${prefsText(ws.profile.preferences)}`);
  lines.push("");
  lines.push("## COMPANIES (ranked by computed compatibility; participation verification shown)");
  for (const c of ranked) {
    const a = ws.assessments.get(c.id)!;
    const part = bestParticipation(ws.participation.get(c.id));
    const booth = boothOf(ws.participation.get(c.id));
    const track = ws.tracking.get(c.id);
    const detailed = !focusCompanyId || focusCompanyId === c.id;
    lines.push(`### ${c.name} [slug:${c.slug}] score ${a.score}/100 (${a.priority.label}; confidence ${a.confidence})`);
    lines.push(`- Industry: ${c.industries.join(", ")}. HQ: ${c.headquarters ?? "n/a"}.`);
    lines.push(`- SHPE 2026: ${part ? `${part.role}${part.tier ? ` ${part.tier}` : ""} — ${part.verification} (source: ${part.source_title ?? "n/a"})` : "not confirmed"}${booth ? `; booth #${booth}` : "; booth not published"}`);
    lines.push(`- Eligibility assessment: ${ELIGIBILITY_LABEL[a.eligibility.status]}. ${a.eligibility.summary}${c.eligibility_notes ? ` Company note: ${c.eligibility_notes}` : ""}`);
    if (detailed) {
      lines.push(`- Engineering focus: ${Object.entries(c.tech_tags).map(([k, t]) => `${DOMAIN_BY_KEY[k as keyof typeof DOMAIN_BY_KEY]?.label}: ${t!.context}`).join("; ")}`);
      lines.push(`- Matched to user: ${a.matchedDomains.slice(0, 5).map((m) => `${m.label} (${m.evidence})`).join("; ") || "little overlap"}`);
      lines.push(`- Description: ${c.description ?? ""}`);
    }
    for (const j of ws.jobs.get(c.id) ?? []) {
      const e = j.eligibility;
      lines.push(`- JOB "${j.title}"${j.requisition_id ? ` (${j.requisition_id})` : ""}, ${j.employment_type}, ${j.location ?? ""}; verification ${j.verification}; listing ${j.listing_status}; eligibility: ${e ? `citizenship_required=${e.citizenship_required}, us_person_required=${e.us_person_required}, clearance=${e.clearance_required}, sponsorship=${e.sponsorship}${e.note ? `, note: ${e.note}` : ""}` : "unknown"}; url ${j.apply_url ?? "n/a"}`);
    }
    for (const r of ws.recruiters.filter((x) => x.company_id === c.id)) {
      lines.push(`- RECRUITER ${r.full_name}, ${r.title ?? ""}; attendance: ${r.attendance_status}; status ${r.contact?.status ?? "none"}${r.contact?.notes ? `; notes: ${r.contact.notes}` : ""}`);
    }
    if (track && track.status !== "none") lines.push(`- User CRM status: ${CRM_LABEL[track.status]}${track.visited_at ? " (visited booth)" : ""}${track.notes ? `; notes: ${track.notes}` : ""}`);
    for (const n of notes.filter((n) => n.entity_id === c.id).slice(0, 3)) lines.push(`- User note: ${n.body}`);
  }
  lines.push("");
  lines.push("## USER INTERACTIONS (most recent first)");
  for (const i of ws.interactions.slice(0, 30)) {
    lines.push(`- ${new Date(i.occurred_at).toISOString().slice(0, 10)} ${i.kind} with ${i.company_name ?? "?"}${i.recruiter_name ? ` / ${i.recruiter_name}` : ""}: ${i.summary}${i.opportunities_discussed ? ` | opportunities: ${i.opportunities_discussed}` : ""}`);
  }
  if (!ws.interactions.length) lines.push("- none logged yet");
  lines.push("## OPEN TASKS");
  for (const t of tasks.filter((t) => !t.done)) lines.push(`- ${t.title}${t.due_at ? ` (due ${t.due_at})` : ""}${t.company_name ? ` [${t.company_name}]` : ""}`);
  lines.push("## APPLICATIONS");
  for (const a of apps) lines.push(`- ${a.title} @ ${a.company_name}: ${a.status}${a.applied_at ? ` (applied ${a.applied_at})` : ""}`);
  return lines.join("\n");
}
