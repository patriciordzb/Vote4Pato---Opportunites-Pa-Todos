import { bestParticipation, boothOf, type Workspace } from "./repo";
import type { Task } from "./types";

export interface PlanItem {
  kind: "visit" | "task" | "follow_up" | "eligibility" | "profile" | "apply";
  title: string;
  detail: string;
  href: string;
  urgency: number; // lower = sooner
}

/** Ordered booth route: verified participants first, then by score. No invented walking times. */
export function boothRoute(ws: Workspace) {
  return ws.companies
    .map((c) => ({ c, a: ws.assessments.get(c.id)!, part: bestParticipation(ws.participation.get(c.id)), booth: boothOf(ws.participation.get(c.id)), track: ws.tracking.get(c.id) }))
    .filter((x) => x.part && x.part.role !== "historical")
    .sort((x, y) => {
      if (x.track?.visit_order != null || y.track?.visit_order != null) return (x.track?.visit_order ?? 999) - (y.track?.visit_order ?? 999);
      const vx = x.part!.verification === "verified" ? 0 : 1;
      const vy = y.part!.verification === "verified" ? 0 : 1;
      return x.a.priority.tier - y.a.priority.tier || vx - vy || y.a.score - x.a.score;
    });
}

export function dailyPlan(ws: Workspace, tasks: Task[], today: string, phase: "before" | "during" | "after"): PlanItem[] {
  const items: PlanItem[] = [];
  const route = boothRoute(ws);

  if (phase !== "after") {
    for (const x of route.filter((r) => !r.track?.visited_at && r.a.priority.tier <= 2).slice(0, 5)) {
      items.push({
        kind: "visit",
        title: `Visit ${x.c.name}${x.booth ? ` · booth #${x.booth}` : ""}`,
        detail: `${x.a.score}/100 · ${x.a.priority.label}${x.part!.verification !== "verified" ? " · booth presence not confirmed, check the floor plan" : ""}`,
        href: `/companies/${x.c.slug}`,
        urgency: 10 + x.a.priority.tier,
      });
    }
  }
  for (const t of tasks.filter((t) => !t.done)) {
    const overdue = t.due_at && t.due_at < today;
    const dueToday = t.due_at === today;
    if (overdue || dueToday || !t.due_at) {
      items.push({ kind: "task", title: t.title, detail: overdue ? `Overdue (due ${t.due_at})` : dueToday ? "Due today" : "No due date", href: t.company_slug ? `/companies/${t.company_slug}` : "/crm", urgency: overdue ? 0 : dueToday ? 1 : 30 });
    }
  }
  for (const c of ws.companies) {
    const tr = ws.tracking.get(c.id);
    if (tr && ["met_recruiter", "visited_booth"].includes(tr.status)) {
      const hasFollowupTask = tasks.some((t) => t.company_id === c.id && !t.done);
      if (!hasFollowupTask) items.push({ kind: "follow_up", title: `Follow up with ${c.name}`, detail: "Met at SHPE. Send a LinkedIn note or thank-you within 48 hours.", href: `/messages?company=${c.slug}&kind=post_convention`, urgency: phase === "after" ? 2 : 20 });
    }
  }
  const prefs = ws.profile.preferences;
  if (prefs.citizenship !== "us_citizen" && (prefs.sponsorship === "unknown" || prefs.usPerson === "unknown" || !prefs.workAuthorization)) {
    items.push({ kind: "eligibility", title: "Complete your work-authorization settings", detail: "Eligibility checks can't be resolved until you set your U.S.-person status, current authorization and sponsorship need.", href: "/profile#preferences", urgency: 5 });
  }
  if (ws.intel.completeness.missing.length) {
    items.push({ kind: "profile", title: "Fill profile gaps", detail: `Missing: ${ws.intel.completeness.missing.join(", ")}`, href: "/profile", urgency: 40 });
  }
  return items.sort((a, b) => a.urgency - b.urgency);
}
