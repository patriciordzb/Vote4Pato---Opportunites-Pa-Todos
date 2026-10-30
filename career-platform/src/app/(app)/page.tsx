import Link from "next/link";
import { CalendarDays, MapPin, ArrowRight, CheckCircle2, AlertTriangle, Footprints, Send, UserCog, ClipboardList } from "lucide-react";
import { Card, PageHeader, Stat, ScoreRing, Badge, Bar, VerificationBadge, ConfidenceBadge, ComputedLabel, ROLE_LABEL } from "@/components/ui";
import { CompanyLogo } from "@/components/client";
import { ActivityChart, CompatibilityChart, IndustryChart, type FactorRow } from "@/components/charts";
import { TaskList } from "@/components/tasks";
import { bestParticipation, boothOf, getWorkspace, listApplications, listTasks } from "@/lib/repo";
import { EVENT, eventPhase } from "@/lib/event";
import { dailyPlan } from "@/lib/plan";

export default async function Dashboard() {
  const ws = await getWorkspace();
  const [tasks, apps] = await Promise.all([listTasks(ws.userId), listApplications(ws.userId)]);
  const { phase, label, today } = eventPhase();

  const verified2026 = ws.companies.filter((c) => (ws.participation.get(c.id) ?? []).some((p) => p.event_year === 2026 && p.verification === "verified"));
  const listed2026 = ws.companies.filter((c) => bestParticipation(ws.participation.get(c.id)));
  const ranked = [...ws.companies].sort((a, b) => ws.assessments.get(b.id)!.score - ws.assessments.get(a.id)!.score);
  const relevantJobs = [...ws.jobs.values()].flat().filter((j) => j.listing_status !== "closed" && (ws.assessments.get(j.company_id)?.jobMatches.find((m) => m.jobId === j.id)?.score ?? 0) >= 40);
  const visited = [...ws.tracking.values()].filter((t) => t.visited_at).length;
  const linkedinTracked = [...ws.tracking.values()].filter((t) => t.status === "connected_linkedin").length + ws.recruiters.filter((r) => r.contact?.status === "connected_linkedin").length;
  const submitted = apps.filter((a) => ["applied", "interviewing", "offer", "rejected"].includes(a.status)).length;
  const openTasks = tasks.filter((t) => !t.done);
  const tier1 = ranked.filter((c) => ws.assessments.get(c.id)!.priority.tier === 1);
  const tier1Visited = tier1.filter((c) => ws.tracking.get(c.id)?.visited_at).length;
  const plan = dailyPlan(ws, tasks, today, phase);

  const chartRows: FactorRow[] = ranked.slice(0, 12).map((c) => {
    const a = ws.assessments.get(c.id)!;
    const f = Object.fromEntries(a.factors.map((x) => [x.key, (x.score * x.weight) / 100]));
    return { name: c.name, slug: c.slug, technical: f.technical, research: f.research, opportunities: f.opportunities, industry: f.industry, networking: f.networking, total: a.score };
  });

  const byDay = new Map<string, number>();
  for (const i of ws.interactions) {
    const d = new Date(i.occurred_at).toISOString().slice(5, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  const activity = [...byDay.entries()].sort().map(([day, interactions]) => ({ day, interactions }));

  const industryCount = new Map<string, number>();
  for (const [cid, t] of ws.tracking) {
    if (t.status === "none" && !t.saved) continue;
    const c = ws.companies.find((x) => x.id === cid);
    if (c) industryCount.set(c.industry, (industryCount.get(c.industry) ?? 0) + 1);
  }
  const industries = [...industryCount.entries()].map(([industry, count]) => ({ industry, count })).sort((a, b) => b.count - a.count);

  const ICON = { visit: Footprints, task: ClipboardList, follow_up: Send, eligibility: AlertTriangle, profile: UserCog, apply: CheckCircle2 } as const;

  return (
    <div className="space-y-6">
      <div className="card relative overflow-hidden p-5 sm:p-6">
        <div className="bg-grid absolute inset-0 opacity-40" aria-hidden />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-accent">{EVENT.name}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Welcome back, {ws.profile.data.fullName.split(" ")[0] || "there"}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {EVENT.dates}</span>
              <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {EVENT.venue}</span>
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <Badge tone={phase === "during" ? "good" : "accent"} className="text-xs">{label}</Badge>
            <Link href="/fair" className="btn-primary">Open Career-Fair Mode <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Verified SHPE 2026 companies" value={verified2026.length} hint={`${listed2026.length} with any 2026 evidence · ${ws.companies.length} in database`} href="/companies?verification=verified" />
        <Stat label="Recruiters identified" value={ws.recruiters.length} hint={ws.recruiters.length ? `${ws.recruiters.filter((r) => r.attendance_status === "confirmed").length} confirmed attending` : "Add people you meet"} href="/recruiters" />
        <Stat label="Relevant job openings" value={relevantJobs.length} hint="Postings on file with a match ≥ 40" href="/jobs" />
        <Stat label="Companies visited" value={visited} hint={`${tier1Visited}/${tier1.length} Tier-1 targets`} href="/strategy" />
        <Stat label="LinkedIn connections tracked" value={linkedinTracked} hint="Status: Connected on LinkedIn" href="/crm" />
        <Stat label="Applications submitted" value={submitted} hint={`${apps.length} tracked total`} href="/jobs" />
        <Stat label="Follow-ups pending" value={openTasks.length} hint={`${openTasks.filter((t) => t.due_at && t.due_at < today).length} overdue`} href="/crm" />
        <Stat label="Interactions logged" value={ws.interactions.length} hint="Booth visits, conversations, messages" href="/crm" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3" title="Today's action plan" subtitle="Built from your rankings, CRM status and open tasks" action={<ComputedLabel />}>
          {plan.length ? (
            <ol className="space-y-2">
              {plan.slice(0, 8).map((p, i) => {
                const Icon = ICON[p.kind];
                return (
                  <li key={i}>
                    <Link href={p.href} className="flex items-start gap-3 rounded-lg border border-line bg-raised/40 p-3 transition hover:border-accent/60">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-accent/15 text-accent"><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{p.title}</span>
                        <span className="block text-xs text-muted">{p.detail}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : <p className="text-sm text-muted">Nothing urgent. Explore companies or practice with the recruiter coach.</p>}
        </Card>

        <Card className="lg:col-span-2" title="Convention progress">
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-xs"><span>Tier-1 booths visited</span><span className="tabular-nums">{tier1Visited}/{tier1.length}</span></div>
              <Bar value={tier1Visited} max={Math.max(1, tier1.length)} tone="good" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs"><span>Verified exhibitors visited</span><span className="tabular-nums">{verified2026.filter((c) => ws.tracking.get(c.id)?.visited_at).length}/{verified2026.length}</span></div>
              <Bar value={verified2026.filter((c) => ws.tracking.get(c.id)?.visited_at).length} max={Math.max(1, verified2026.length)} />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs"><span>Follow-up completion</span><span className="tabular-nums">{tasks.filter((t) => t.done).length}/{tasks.length}</span></div>
              <Bar value={tasks.filter((t) => t.done).length} max={Math.max(1, tasks.length)} tone="warn" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs"><span>Profile completeness</span><span className="tabular-nums">{ws.intel.completeness.score}%</span></div>
              <Bar value={ws.intel.completeness.score} />
            </div>
            <div className="border-t border-line pt-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Upcoming tasks</p>
              <TaskList tasks={openTasks.slice(0, 5)} compact />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2" title="Top company matches" action={<Link href="/companies" className="text-xs text-accent hover:underline">All companies →</Link>}>
          <ul className="space-y-2">
            {ranked.slice(0, 7).map((c) => {
              const a = ws.assessments.get(c.id)!;
              const p = bestParticipation(ws.participation.get(c.id));
              const booth = boothOf(ws.participation.get(c.id));
              return (
                <li key={c.id}>
                  <Link href={`/companies/${c.slug}`} className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-raised">
                    <CompanyLogo name={c.name} domain={c.domain} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {p ? <VerificationBadge level={p.verification} title={`${ROLE_LABEL[p.role]}: ${p.evidence}`} /> : <Badge>2026 unconfirmed</Badge>}
                        {booth && <Badge tone="accent">Booth #{booth}</Badge>}
                        <ConfidenceBadge level={a.confidence} />
                      </div>
                    </div>
                    <ScoreRing score={a.score} size={44} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card className="lg:col-span-3" title="Compatibility breakdown (top 12)" subtitle="Each segment is a factor's weighted contribution, so bars sum to the overall score">
          <CompatibilityChart rows={chartRows} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Networking activity over time"><ActivityChart data={activity} /></Card>
        <Card title="Tracked companies by industry"><IndustryChart data={industries} /></Card>
      </div>
    </div>
  );
}
