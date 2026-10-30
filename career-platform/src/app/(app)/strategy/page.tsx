import Link from "next/link";
import { Badge, Card, PageHeader, VerificationBadge, ComputedLabel, SetupNotice, EligibilityBadge } from "@/components/ui";
import { getWorkspace, listApplications, listTasks } from "@/lib/repo";
import { boothRoute, dailyPlan } from "@/lib/plan";
import { buildPrep } from "@/lib/coach";
import { eventPhase, EVENT } from "@/lib/event";
import { BoothChecklist, type ChecklistItem } from "./client";

export const metadata = { title: "Convention Strategy" };

export default async function StrategyPage() {
  const ws = await getWorkspace();
  const [tasks, apps] = await Promise.all([listTasks(ws.userId), listApplications(ws.userId)]);
  const route = boothRoute(ws);
  const items: ChecklistItem[] = route.map((x) => {
    const prep = buildPrep(x.c, x.a, ws.profile.data, ws.profile.preferences, ws.jobs.get(x.c.id) ?? []);
    return {
      id: x.c.id, slug: x.c.slug, name: x.c.name, booth: x.booth, verification: x.part!.verification, role: x.part!.role,
      score: x.a.score, tier: x.a.priority.tier, label: x.a.priority.label, pitch: prep.pitch15, question: prep.questions[1] ?? prep.questions[0],
      visited: Boolean(x.track?.visited_at), order: x.track?.visit_order ?? null,
    };
  });
  const technical = [...ws.companies].sort((a, b) => ws.assessments.get(b.id)!.factors[0].score - ws.assessments.get(a.id)!.factors[0].score).slice(0, 6);
  const jobs = [...ws.jobs.values()].flat().map((j) => ({ j, a: ws.assessments.get(j.company_id)! })).map(({ j, a }) => ({ j, m: a.jobMatches.find((m) => m.jobId === j.id), e: a.eligibility.jobs.find((x) => x.jobId === j.id)?.result }))
    .sort((x, y) => (y.m?.score ?? 0) - (x.m?.score ?? 0));
  const { phase, today } = eventPhase();
  const followUps = dailyPlan(ws, tasks, today, phase).filter((p) => p.kind === "follow_up" || p.kind === "task");
  const recruitersToPrioritize = ws.recruiters.filter((r) => r.attendance_status !== "unverified").sort((a, b) => (ws.assessments.get(b.company_id)?.score ?? 0) - (ws.assessments.get(a.company_id)?.score ?? 0)).slice(0, 6);
  const appsAttention = apps.filter((a) => a.status === "saved" || a.status === "preparing");

  return (
    <div className="space-y-5">
      <PageHeader title="Convention Strategy" subtitle="Your personalized game plan: who to see first, what to say, and what to do afterward." />
      <SetupNotice title="No verified floor plan">
        The official SHPE 2026 floor plan wasn&apos;t retrievable, so no booth coordinates, walking routes or walking times are shown. Booth numbers appear only where a company published its own (e.g., Microsoft #831, Mortenson #1121). Use the order below with the SHPE app map. Career-fair hours ({EVENT.career_fair.map((f) => `${f.day.slice(5)} ${f.hours}`).join("; ")}) come from a chapter page and are partially verified.
      </SetupNotice>

      <Card title="Booth visit checklist" subtitle="Order: your visit # if set, then priority tier, then verified participation, then score. Partially verified companies may not have a booth." action={<ComputedLabel />}>
        <BoothChecklist items={items} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Strongest technical matches">
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {technical.map((c) => {
              const a = ws.assessments.get(c.id)!;
              return <li key={c.id}><Link className="font-medium hover:text-accent" href={`/companies/${c.slug}`}>{c.name}</Link> <span className="text-muted">technical {a.factors[0].score}/100: {a.matchedDomains.slice(0, 3).map((m) => m.label).join(", ")}</span></li>;
            })}
          </ol>
        </Card>
        <Card title="Most promising opportunities">
          {jobs.length ? (
            <ul className="space-y-2 text-sm">
              {jobs.slice(0, 6).map(({ j, m, e }) => (
                <li key={j.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span><Link className="hover:text-accent" href={`/companies/${j.company_slug}#jobs`}>{j.title}</Link> <span className="text-muted">· {j.company_name}</span></span>
                  <span className="flex gap-1">{m && <Badge tone="accent">Match {m.score}</Badge>}{e && <EligibilityBadge status={e.status} />}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">No postings on file yet.</p>}
          <Link className="mt-2 inline-block text-xs text-accent hover:underline" href="/jobs">Job tracker →</Link>
        </Card>
        <Card title="Recruiters to prioritize">
          {recruitersToPrioritize.length ? (
            <ul className="space-y-1 text-sm">{recruitersToPrioritize.map((r) => <li key={r.id}>{r.full_name} <span className="text-muted">· {r.company_name} · {r.attendance_status}</span></li>)}</ul>
          ) : <p className="text-sm text-muted">No confirmed or potential recruiters recorded yet. Add them as you meet people. The Recruiters page links to LinkedIn searches for your top companies.</p>}
        </Card>
        <Card title="Applications & follow-ups needing attention">
          <ul className="space-y-1 text-sm">
            {appsAttention.map((a) => <li key={a.id}>Submit: {a.title} <span className="text-muted">· {a.company_name}</span></li>)}
            {followUps.map((f, i) => <li key={i}><Link className="hover:text-accent" href={f.href}>{f.title}</Link> <span className="text-xs text-muted">{f.detail}</span></li>)}
            {!appsAttention.length && !followUps.length && <li className="text-muted">Nothing pending.</li>}
          </ul>
        </Card>
      </div>

      <Card title="Where participation evidence is weakest">
        <ul className="flex flex-wrap gap-1.5">
          {route.filter((x) => x.part!.verification !== "verified").slice(0, 20).map((x) => <li key={x.c.id}><Link href={`/companies/${x.c.slug}#booth`}><VerificationBadge level={x.part!.verification} title={x.part!.evidence} /> <span className="text-xs">{x.c.name}</span></Link></li>)}
        </ul>
      </Card>
    </div>
  );
}
