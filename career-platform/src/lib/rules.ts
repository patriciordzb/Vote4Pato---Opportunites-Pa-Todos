import "server-only";
import { bestParticipation, boothOf, type Workspace } from "./repo";
import { ELIGIBILITY_LABEL } from "./eligibility";
import { CRM_LABEL } from "./types";

// Rule-based answers for the most common assistant questions. These work with
// no AI key, so the assistant is still useful on the convention floor. Every
// answer is computed from the database and labelled as such.

type Rule = { test: RegExp; answer: (ws: Workspace, q: string) => string };

function ranked(ws: Workspace, filter: (c: Workspace["companies"][number]) => boolean = () => true) {
  return ws.companies.filter(filter).sort((a, b) => (ws.assessments.get(b.id)?.score ?? 0) - (ws.assessments.get(a.id)?.score ?? 0));
}

function line(ws: Workspace, c: Workspace["companies"][number]) {
  const a = ws.assessments.get(c.id)!;
  const p = bestParticipation(ws.participation.get(c.id));
  const booth = boothOf(ws.participation.get(c.id));
  return `- **${c.name}**: ${a.score}/100 (${a.priority.label}); SHPE 2026 ${p ? `${p.role.replace("_", " ")}, ${p.verification.replace("_", " ")}` : "not confirmed"}${booth ? `, booth #${booth}` : ""}`;
}

const RULES: Rule[] = [
  {
    test: /aerospace|defen[cs]e|space/i,
    answer: (ws) => {
      const list = ranked(ws, (c) => c.industries.some((i) => /Aerospace|Space/.test(i))).slice(0, 8);
      return `Aerospace and space companies in your database, best match first:\n${list.map((c) => line(ws, c)).join("\n")}\n\nVisit verified exhibitors first. Partially verified companies (e.g., SHPE IPC partners) may not have a booth, so check the official floor plan in the SHPE app.`;
    },
  },
  {
    test: /additive|\bam\b|3d.?print|lpbf|powder bed/i,
    answer: (ws) => {
      const list = ranked(ws, (c) => Boolean(c.tech_tags.additive_manufacturing || c.tech_tags.lpbf)).slice(0, 10);
      return `Companies whose records document additive-manufacturing work:\n${list.map((c) => `${line(ws, c)}. AM context: ${c.tech_tags.additive_manufacturing?.context ?? c.tech_tags.lpbf?.context}`).join("\n")}`;
    },
  },
  {
    test: /citizen|sponsor|visa|eligib|authori[sz]|non.?citizen|international/i,
    answer: (ws) => {
      const rows = ws.companies.map((c) => ({ c, a: ws.assessments.get(c.id)! })).filter((x) => x.a.eligibility.jobs.length);
      const offered = ws.companies.flatMap((c) => (ws.jobs.get(c.id) ?? []).filter((j) => j.eligibility?.sponsorship === "offered").map((j) => `${c.name}: ${j.title}`));
      return `**Documented eligibility in your database** (only postings with explicit statements are counted):\n${rows.map((x) => `- ${x.c.name}: ${ELIGIBILITY_LABEL[x.a.eligibility.status]}. ${x.a.eligibility.summary}`).join("\n") || "- No postings with eligibility statements yet."}\n\nPostings that explicitly offer sponsorship: ${offered.length ? offered.join("; ") : "none on file."}\n\nNo company in the database documents a company-wide policy for non-citizen candidates. Ask each recruiter which teams can consider your situation, and record what they say in your notes.`;
    },
  },
  {
    test: /not visited|haven.?t visited|still need|remaining|left to visit/i,
    answer: (ws) => {
      const list = ranked(ws, (c) => {
        const p = bestParticipation(ws.participation.get(c.id));
        return !!p && p.verification === "verified" && !ws.tracking.get(c.id)?.visited_at;
      });
      return `Verified SHPE 2026 participants you haven't marked as visited (${list.length}):\n${list.map((c) => line(ws, c)).join("\n") || "- None. You've visited every verified exhibitor."}`;
    },
  },
  {
    test: /follow.?up|follow up|reach out/i,
    answer: (ws) => {
      const due = ws.companies.filter((c) => ["met_recruiter", "visited_booth", "follow_up_needed"].includes(ws.tracking.get(c.id)?.status ?? ""));
      const rec = ws.recruiters.filter((r) => ["met_recruiter", "follow_up_needed"].includes(r.contact?.status ?? ""));
      return `**Follow-ups suggested from your CRM:**\n${due.map((c) => `- ${c.name} (${CRM_LABEL[ws.tracking.get(c.id)!.status]})`).join("\n") || "- No companies are in a follow-up status."}\n${rec.map((r) => `- ${r.full_name}, ${r.company_name}`).join("\n")}\n\nUse Messages → "Post-convention follow-up". It drafts from your logged conversation notes.`;
    },
  },
  {
    test: /visit first|first|priorit|top|best match|start/i,
    answer: (ws) => {
      const list = ranked(ws).filter((c) => ws.assessments.get(c.id)!.priority.tier <= 2).slice(0, 8);
      return `Your top priorities from the compatibility engine:\n${list.map((c) => line(ws, c)).join("\n")}\n\nThe Strategy page turns these into an ordered booth checklist.`;
    },
  },
  {
    test: /resume|improve|weakness|gap/i,
    answer: (ws) => `**Profile gaps found by the analysis engine:**\n${ws.intel.gaps.map((g) => `- ${g.reason}`).join("\n")}\n\n**Transferable strengths to emphasize:**\n${ws.intel.transferable.map((t) => `- ${t}`).join("\n")}`,
  },
];

export function ruleBasedAnswer(ws: Workspace, question: string): string | null {
  const ql = question.toLowerCase();
  const companyHit = ws.companies.find((c) => {
    const name = c.name.toLowerCase();
    const first = name.split(" ")[0];
    return ql.includes(name) || (first.length >= 4 && new RegExp(`\\b${first.replace(/[^a-z0-9]/g, "")}\\b`).test(ql));
  });
  if (companyHit && /say|talk|pitch|relate|grx|research|fit|why/i.test(question)) {
    const a = ws.assessments.get(companyHit.id)!;
    return `**${companyHit.name}**: ${a.score}/100, ${a.priority.label}.\n\nWhere your background connects:\n${a.matchedDomains.slice(0, 4).map((m) => `- ${m.label}: ${m.evidence} ↔ ${m.context}`).join("\n") || "- Little documented overlap."}\n\nOpen the company page (Coach section) for 15/30/60-second pitches, talking points and questions.`;
  }
  for (const r of RULES) if (r.test.test(question)) return r.answer(ws, question);
  return null;
}
