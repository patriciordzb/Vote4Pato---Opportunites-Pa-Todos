import Link from "next/link";
import { Badge, Card, ExtLink, PageHeader, Empty, ComputedLabel } from "@/components/ui";
import { CopyButton, Disclosure } from "@/components/client";
import { RecruiterForm, RecruiterContactControls } from "@/components/forms";
import { getWorkspace } from "@/lib/repo";
import { buildMessage, buildPrep, linkedinPeopleSearch } from "@/lib/coach";
import { RecruiterFilter } from "./filter";
import { ActionButton } from "@/components/client";
import { deleteRecruiter } from "@/app/actions";

export const metadata = { title: "Recruiter Directory" };

const ATTENDANCE = {
  confirmed: { label: "Confirmed attending", tone: "good" as const, help: "Public evidence names this person at SHPE 2026." },
  potential: { label: "Potential contact", tone: "accent" as const, help: "Relevant at this company; personal attendance not verified." },
  unverified: { label: "Unverified", tone: "neutral" as const, help: "Not enough evidence of participation." },
};

export default async function RecruitersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const ws = await getWorkspace();
  const needle = (sp.q ?? "").toLowerCase();
  const recruiters = ws.recruiters.filter((r) =>
    (!needle || [r.full_name, r.title, r.company_name, r.specialization, r.engineering_focus].join(" ").toLowerCase().includes(needle)) &&
    (!sp.status || r.attendance_status === sp.status || (sp.status === "saved" && r.contact?.saved)));
  const companies = ws.companies.map((c) => ({ id: c.id, name: c.name }));
  const top = [...ws.companies].sort((a, b) => ws.assessments.get(b.id)!.score - ws.assessments.get(a.id)!.score).slice(0, 8);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recruiter Directory"
        subtitle="People you can actually meet. No recruiter is pre-filled: no individual could be publicly verified as attending SHPE 2026, and the app never invents identities or assumes that an exhibitor's employees attend."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <RecruiterFilter q={sp.q ?? ""} status={sp.status ?? ""} />
          {recruiters.length === 0 ? (
            <Empty title={ws.recruiters.length ? "No recruiters match" : "No recruiters yet"}>
              {ws.recruiters.length ? "Clear the filter to see everyone." : "Add recruiters as you meet them at booths, or after finding them on LinkedIn. Each card then gets a 30-second intro, conversation starters, questions and ready-to-send messages."}
            </Empty>
          ) : recruiters.map((r) => {
            const company = ws.companies.find((c) => c.id === r.company_id)!;
            const a = ws.assessments.get(company.id)!;
            const prep = buildPrep(company, a, ws.profile.data, ws.profile.preferences, ws.jobs.get(company.id) ?? []);
            const conn = buildMessage({ kind: "connection", profile: ws.profile.data, company, recruiter: r, matchedContext: a.matchedDomains[0]?.context });
            const email = buildMessage({ kind: "post_convention", profile: ws.profile.data, company, recruiter: r, matchedContext: a.matchedDomains[0]?.context, conversationNotes: r.contact?.notes ?? undefined });
            const att = ATTENDANCE[r.attendance_status];
            return (
              <Card key={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">{r.full_name}</p>
                    <p className="text-sm text-muted">{r.title ?? "Title not recorded"} · <Link className="hover:text-accent" href={`/companies/${company.slug}`}>{company.name}</Link></p>
                    {(r.specialization || r.engineering_focus) && <p className="mt-1 text-xs">Specialty: {[r.specialization, r.engineering_focus].filter(Boolean).join(" · ")}</p>}
                    {r.background && <p className="mt-1 text-xs text-muted">{r.background}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={att.tone} title={att.help}>{att.label}</Badge>
                    <Badge tone="accent">Company match {a.score}/100</Badge>
                    {r.linkedin_url && <ExtLink href={r.linkedin_url} className="text-xs">LinkedIn profile</ExtLink>}
                  </div>
                </div>
                {r.evidence.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-muted">{r.evidence.map((e, i) => <li key={i}>Evidence ({e.kind}): {e.evidence} {e.source_url && <ExtLink href={e.source_url}>source</ExtLink>}</li>)}</ul>
                )}
                <div className="mt-3"><RecruiterContactControls recruiterId={r.id} status={r.contact?.status ?? "none"} saved={r.contact?.saved ?? false} notes={r.contact?.notes ?? ""} mutual={r.contact?.mutual_connections ?? ""} /></div>
                <div className="mt-3 space-y-2">
                  <Disclosure summary={<>Conversation prep <ComputedLabel /></>}>
                    <p className="label">30-second introduction</p>
                    <p className="mb-2 rounded-lg bg-raised/60 p-2">{prep.pitch30}</p>
                    <p className="label">Conversation starters</p>
                    <ol className="mb-2 list-decimal pl-5">{prep.starters.map((s) => <li key={s}>{s}</li>)}</ol>
                    <p className="label">Questions to ask</p>
                    <ol className="mb-2 list-decimal pl-5">{prep.questions.slice(0, 5).map((s) => <li key={s}>{s}</li>)}</ol>
                    <p className="label">Technical topics</p>
                    <ul className="mb-2 list-disc pl-5">{prep.talkingPoints.slice(0, 4).map((t) => <li key={t.topic}>{t.topic}</li>)}</ul>
                    <p className="label">Highlight</p>
                    <ul className="list-disc pl-5">{prep.why.slice(0, 2).map((w) => <li key={w}>{w}</li>)}</ul>
                    <p className="mt-2 text-xs text-muted">Shared interests are only shown when verified. Record any you learn in the notes field above.</p>
                  </Disclosure>
                  <Disclosure summary="LinkedIn connection message & follow-up email">
                    <p className="label">Connection request ({conn.length}/300)</p>
                    <p className="mb-1 whitespace-pre-wrap rounded-lg bg-raised/60 p-2">{conn}</p>
                    <div className="mb-3 flex gap-2"><CopyButton text={conn} />{r.linkedin_url && <a className="btn-ghost" href={r.linkedin_url} target="_blank" rel="noopener noreferrer">Open profile</a>}</div>
                    <p className="label">Follow-up email</p>
                    <p className="mb-1 whitespace-pre-wrap rounded-lg bg-raised/60 p-2">{email}</p>
                    <div className="flex gap-2"><CopyButton text={email} /><Link className="btn-ghost" href={`/messages?company=${company.slug}&recruiter=${r.id}`}>More message types</Link></div>
                  </Disclosure>
                </div>
                {r.created_by === "user" && (
                  <div className="mt-2 text-right"><ActionButton action={deleteRecruiter.bind(null, r.id)} confirm={`Delete ${r.full_name} and their evidence?`} className="text-xs text-bad hover:underline">Delete</ActionButton></div>
                )}
              </Card>
            );
          })}
        </div>

        <div className="space-y-5">
          <Card title="Add a recruiter or contact"><RecruiterForm companies={companies} /></Card>
          <Card title="Find recruiters on LinkedIn" subtitle="Searches open in your own LinkedIn session for your top matches">
            <ul className="space-y-1.5 text-sm">
              {top.map((c) => <li key={c.id} className="flex items-center justify-between gap-2"><span className="truncate">{c.name}</span><ExtLink href={linkedinPeopleSearch(c.name)} className="text-xs">Search</ExtLink></li>)}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
