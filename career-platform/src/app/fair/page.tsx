import { bestParticipation, boothOf, getWorkspace, listTasks } from "@/lib/repo";
import { buildPrep } from "@/lib/coach";
import { eventPhase } from "@/lib/event";
import { FairApp, type FairCompany } from "./client";

export const metadata = { title: "Career-Fair Mode" };

export default async function FairPage() {
  const ws = await getWorkspace();
  const tasks = await listTasks(ws.userId);
  const companies: FairCompany[] = ws.companies.map((c) => {
    const a = ws.assessments.get(c.id)!;
    const p = bestParticipation(ws.participation.get(c.id));
    const t = ws.tracking.get(c.id);
    const prep = buildPrep(c, a, ws.profile.data, ws.profile.preferences, ws.jobs.get(c.id) ?? []);
    return {
      id: c.id, slug: c.slug, name: c.name, industry: c.industry, booth: boothOf(ws.participation.get(c.id)),
      verification: p?.verification ?? null, score: a.score, tier: a.priority.tier,
      summary: a.matchedDomains.slice(0, 2).map((m) => m.context).join("; ") || (c.description ?? "").slice(0, 120),
      pitch15: prep.pitch15, pitch30: prep.pitch30, question: prep.questions[1] ?? prep.questions[0], ask: prep.questions[5],
      status: t?.status ?? "none", saved: t?.saved ?? false, visited: Boolean(t?.visited_at),
      recruiters: ws.recruiters.filter((r) => r.company_id === c.id).map((r) => ({ id: r.id, name: r.full_name, title: r.title, attendance: r.attendance_status })),
    };
  }).sort((a, b) => a.tier - b.tier || b.score - a.score);
  const { label } = eventPhase();
  return <FairApp companies={companies} tasks={tasks.filter((t) => !t.done).slice(0, 10)} phaseLabel={label} />;
}
