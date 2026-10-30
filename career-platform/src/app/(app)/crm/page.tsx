import { Card, PageHeader, Stat } from "@/components/ui";
import { ActivityChart, IndustryChart } from "@/components/charts";
import { AddTaskForm, TaskList } from "@/components/tasks";
import { getWorkspace, listApplications, listTasks } from "@/lib/repo";
import { CrmBoard, InteractionLog, QuickLog, type BoardItem } from "./client";

export const metadata = { title: "Networking CRM" };

export default async function CrmPage() {
  const ws = await getWorkspace();
  const [tasks, apps] = await Promise.all([listTasks(ws.userId), listApplications(ws.userId)]);

  const items: BoardItem[] = [
    ...ws.companies.map((c) => {
      const t = ws.tracking.get(c.id);
      return {
        id: c.id, kind: "company" as const, name: c.name, sub: c.industry, href: `/companies/${c.slug}`, status: t?.status ?? "none",
        score: ws.assessments.get(c.id)!.score, notes: t?.notes ?? "", saved: t?.saved ?? false, visited: Boolean(t?.visited_at),
        interactions: ws.interactions.filter((i) => i.company_id === c.id).length,
      };
    }),
    ...ws.recruiters.map((r) => ({
      id: r.id, kind: "recruiter" as const, name: r.full_name, sub: `${r.title ?? "Contact"} · ${r.company_name}`, href: `/recruiters?q=${encodeURIComponent(r.full_name)}`,
      status: r.contact?.status ?? "none", score: ws.assessments.get(r.company_id)?.score ?? 0, notes: r.contact?.notes ?? "", saved: r.contact?.saved ?? false, visited: false,
      interactions: ws.interactions.filter((i) => i.recruiter_id === r.id).length,
    })),
  ];

  const companyInteractions = ws.interactions.filter((i) => i.company_id).length;
  const recruiterInteractions = ws.interactions.filter((i) => i.recruiter_id).length;
  const submitted = apps.filter((a) => ["applied", "interviewing", "offer", "rejected"].includes(a.status)).length;
  const interviews = apps.filter((a) => a.status === "interviewing" || a.status === "offer").length + [...ws.tracking.values()].filter((t) => t.status === "interview_scheduled").length;
  const doneRate = tasks.length ? Math.round((100 * tasks.filter((t) => t.done).length) / tasks.length) : 0;

  const byDay = new Map<string, number>();
  for (const i of ws.interactions) { const d = new Date(i.occurred_at).toISOString().slice(5, 10); byDay.set(d, (byDay.get(d) ?? 0) + 1); }
  const activity = [...byDay.entries()].sort().map(([day, interactions]) => ({ day, interactions }));
  const ind = new Map<string, number>();
  for (const it of items.filter((x) => x.kind === "company" && (x.status !== "none" || x.saved))) {
    const c = ws.companies.find((c) => c.id === it.id)!;
    ind.set(c.industry, (ind.get(c.industry) ?? 0) + 1);
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Networking CRM" subtitle="Track every company and person you meet, from Want to Meet through Offer Received. Everything is saved to your database." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Company interactions" value={companyInteractions} />
        <Stat label="Recruiter interactions" value={recruiterInteractions} />
        <Stat label="Applications submitted" value={submitted} />
        <Stat label="Follow-up completion" value={`${doneRate}%`} hint={`${tasks.filter((t) => t.done).length}/${tasks.length} tasks`} />
        <Stat label="Interviews" value={interviews} />
      </div>

      <Card title="Quick log" subtitle="Record a conversation in seconds. It updates the pipeline and can create a follow-up task.">
        <QuickLog companies={ws.companies.map((c) => ({ id: c.id, name: c.name }))} recruiters={ws.recruiters.map((r) => ({ id: r.id, name: r.full_name, company_id: r.company_id }))} />
      </Card>

      <Card title="Pipeline">
        <CrmBoard items={items} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Follow-up tasks">
          <AddTaskForm companies={ws.companies.map((c) => ({ id: c.id, name: c.name }))} />
          <div className="mt-3"><TaskList tasks={tasks} /></div>
        </Card>
        <Card title="Interaction log"><InteractionLog interactions={ws.interactions} /></Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Progress over time"><ActivityChart data={activity} /></Card>
        <Card title="Opportunities by industry"><IndustryChart data={[...ind.entries()].map(([industry, count]) => ({ industry, count })).sort((a, b) => b.count - a.count)} /></Card>
      </div>
    </div>
  );
}
