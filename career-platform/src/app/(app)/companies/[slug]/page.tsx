import Link from "@/components/link";
import { notFound } from "next/navigation";
import { Globe, Briefcase, Linkedin, Users, Mic, MessageSquareText, MapPin } from "lucide-react";
import {
  Badge, Bar, Card, ConfidenceBadge, EligibilityBadge, ExtLink, ScoreRing, VerificationBadge, AiLabel, ComputedLabel, ROLE_LABEL, Empty, fmtDate, scoreTone,
} from "@/components/ui";
import { CompanyLogo, CopyButton, Disclosure } from "@/components/client";
import { AiGenerate, InteractionForm, NoteForm, NoteItem, RecruiterForm, TrackingControls, RecruiterContactControls } from "@/components/forms";
import { TaskList, AddTaskForm } from "@/components/tasks";
import { getWorkspace, listNotes, listTasks, boothOf } from "@/lib/repo";
import { buildPrep, linkedinCompanySearch, linkedinPeopleSearch } from "@/lib/coach";
import { FACTOR_LABEL } from "@/lib/scoring";
import { DOMAIN_BY_KEY, type DomainKey } from "@/lib/taxonomy";
import { ELIGIBILITY_LABEL } from "@/lib/eligibility";
import { aiConfigured } from "@/lib/ai";
import { CRM_LABEL } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: slug.replace(/-/g, " ") };
}

const SECTIONS = [
  ["overview", "Overview"], ["fit", "Why you fit"], ["score", "Compatibility"], ["jobs", "Opportunities"], ["eligibility", "Work authorization"],
  ["recruiters", "Recruiters"], ["pitch", "Pitch"], ["talk", "Talking points"], ["questions", "Questions"], ["booth", "Booth & evidence"], ["notes", "Notes & follow-up"],
];

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ws = await getWorkspace();
  const company = ws.companies.find((c) => c.slug === slug);
  if (!company) notFound();
  const a = ws.assessments.get(company.id)!;
  const parts = ws.participation.get(company.id) ?? [];
  const jobs = ws.jobs.get(company.id) ?? [];
  const recruiters = ws.recruiters.filter((r) => r.company_id === company.id);
  const track = ws.tracking.get(company.id);
  const booth = boothOf(parts);
  const prep = buildPrep(company, a, ws.profile.data, ws.profile.preferences, jobs);
  const [notes, tasks] = await Promise.all([listNotes(ws.userId, "company", company.id), listTasks(ws.userId)]);
  const companyTasks = tasks.filter((t) => t.company_id === company.id);
  const interactions = ws.interactions.filter((i) => i.company_id === company.id);
  const ai = aiConfigured();
  const tags = (Object.entries(company.tech_tags) as [DomainKey, { weight: number; context: string }][]).sort((x, y) => y[1].weight - x[1].weight);

  return (
    <div className="space-y-5">
      <div className="card p-4 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <CompanyLogo name={company.name} domain={company.domain} size={56} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
            <p className="text-sm text-muted">{company.industries.join(" · ")}{company.headquarters ? ` · HQ ${company.headquarters}` : ""}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={a.priority.tier === 1 ? "good" : a.priority.tier === 2 ? "accent" : "neutral"}>{a.priority.label}</Badge>
              <ConfidenceBadge level={a.confidence} />
              <EligibilityBadge status={a.eligibility.status} />
              {booth && <Badge tone="accent"><MapPin className="h-3 w-3" /> Booth #{booth}</Badge>}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {company.website && <ExtLink href={company.website}><Globe className="h-3.5 w-3.5" /> Website</ExtLink>}
              {(company.careers_url || company.website) && <ExtLink href={company.careers_url ?? company.website!}><Briefcase className="h-3.5 w-3.5" /> Careers</ExtLink>}
              <ExtLink href={company.linkedin_url ?? linkedinCompanySearch(company.name)}><Linkedin className="h-3.5 w-3.5" /> LinkedIn company page</ExtLink>
              <ExtLink href={linkedinPeopleSearch(company.name)}><Users className="h-3.5 w-3.5" /> Find recruiters on LinkedIn</ExtLink>
            </div>
          </div>
          <div className="flex items-center gap-3 md:flex-col md:items-end">
            <ScoreRing score={a.score} size={76} />
            <div className="flex gap-2">
              <Link href={`/coach?company=${company.slug}`} className="btn-ghost"><Mic className="h-4 w-4" /> Practice</Link>
              <Link href={`/messages?company=${company.slug}`} className="btn-ghost"><MessageSquareText className="h-4 w-4" /> Message</Link>
            </div>
          </div>
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <TrackingControls companyId={company.id} status={track?.status ?? "none"} saved={track?.saved ?? false} visited={Boolean(track?.visited_at)} visitOrder={track?.visit_order ?? null} />
        </div>
      </div>

      <nav className="sticky top-[53px] z-20 -mx-4 overflow-x-auto border-b border-line bg-bg/90 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-lg sm:border" aria-label="Sections">
        <div className="flex gap-1 whitespace-nowrap">
          {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-md px-2.5 py-1 text-xs text-muted hover:bg-raised hover:text-fg">{label}</a>)}
        </div>
      </nav>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title={<span id="overview">1 · Company overview</span>} action={<VerificationBadge level={company.profile_verification} title="Compiled from public company information; re-check on the official site" />}>
            <p className="text-sm leading-relaxed">{company.description}</p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {company.size && <div><dt className="label">Size</dt><dd>{company.size}</dd></div>}
              {company.presence && <div><dt className="label">Geographic presence</dt><dd>{company.presence}</dd></div>}
            </dl>
            {company.products.length > 0 && <div className="mt-3"><p className="label">Major products & technologies</p><div className="flex flex-wrap gap-1">{company.products.map((p) => <Badge key={p}>{p}</Badge>)}</div></div>}
            <p className="mt-3 text-xs text-muted">Profile last compiled {fmtDate(company.last_verified_at)}.</p>
          </Card>

          <Card title="2 · Engineering technologies & departments">
            <ul className="grid gap-2 sm:grid-cols-2">
              {tags.map(([k, t]) => {
                const mine = ws.intel.skills.get(k)?.strength ?? 0;
                return (
                  <li key={k} className="rounded-lg border border-line p-2.5">
                    <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{DOMAIN_BY_KEY[k].label}</span><span className="text-[11px] text-muted">{"●".repeat(t.weight)}{"○".repeat(3 - t.weight)}</span></div>
                    <p className="mt-0.5 text-xs text-muted">{t.context}</p>
                    <div className="mt-1.5 flex items-center gap-2"><span className="w-16 text-[11px] text-muted">Your evidence</span><Bar value={mine * 100} tone={mine >= 0.5 ? "good" : mine >= 0.2 ? "accent" : "neutral"} /></div>
                  </li>
                );
              })}
            </ul>
            {company.engineering_areas.length > 0 && <div className="mt-3"><p className="label">Engineering departments & programs</p><div className="flex flex-wrap gap-1">{company.engineering_areas.map((e) => <Badge key={e} tone="accent">{e}</Badge>)}</div></div>}
            {company.technical_challenges.length > 0 && (
              <div className="mt-3"><p className="label flex items-center gap-2">Technical challenges <AiLabel>Interpretation</AiLabel></p>
                <ul className="list-disc pl-5 text-sm">{company.technical_challenges.map((c) => <li key={c}>{c}</li>)}</ul></div>
            )}
          </Card>

          <Card title="3 · Recent developments">
            {company.recent_developments.length ? (
              <ul className="space-y-1 text-sm">{company.recent_developments.map((d, i) => <li key={i}>{d.date && <span className="text-muted">{d.date} · </span>}{d.text} {d.url && <ExtLink href={d.url}>source</ExtLink>}</li>)}</ul>
            ) : <Empty title="No sourced developments on file">Recent news wasn&apos;t verified for this snapshot. Add sourced items through a JSON import (Data &amp; Sources), or ask the recruiter what&apos;s new on their team.</Empty>}
          </Card>

          <Card title={<span id="fit">4 · Why you fit {company.name}</span>} action={<ComputedLabel />}>
            <ul className="space-y-2 text-sm">{prep.why.map((w, i) => <li key={i} className="rounded-lg bg-raised/50 p-3 leading-relaxed">{w}</li>)}</ul>
            {a.missingQualifications.length > 0 && (
              <div className="mt-3"><p className="label">Missing or weak qualifications</p><ul className="list-disc pl-5 text-sm text-muted">{a.missingQualifications.map((m) => <li key={m}>{m}</li>)}</ul></div>
            )}
          </Card>

          <Card title={<span id="score">5 · Compatibility analysis: {a.score}/100</span>} subtitle="Weighted: technical 30 · research 25 · opportunities 20 · industry 15 · networking 10" action={<ComputedLabel />}>
            <div className="space-y-4">
              {a.factors.map((f) => (
                <div key={f.key}>
                  <div className="mb-1 flex items-center justify-between text-sm"><span className="font-medium">{FACTOR_LABEL[f.key]} <span className="text-xs text-muted">({f.weight}%)</span></span><span className="tabular-nums text-muted">{f.score}/100 → {((f.score * f.weight) / 100).toFixed(1)} pts</span></div>
                  <Bar value={f.score} tone={scoreTone(f.score)} />
                  {f.evidence.length > 0 && <ul className="mt-1.5 space-y-0.5 text-xs">{f.evidence.map((e) => <li key={e} className="text-fg/90">✓ {e}</li>)}</ul>}
                  {f.gaps.length > 0 && <ul className="mt-1 space-y-0.5 text-xs text-muted">{f.gaps.map((g) => <li key={g}>△ {g}</li>)}</ul>}
                </div>
              ))}
              <div className="rounded-lg border border-line p-3 text-xs">
                <p className="font-medium">Confidence: {a.confidence}</p>
                <ul className="mt-1 list-disc pl-4 text-muted">{a.confidenceReasons.map((r) => <li key={r}>{r}</li>)}</ul>
                {a.evidenceGaps.length > 0 && <p className="mt-2 text-warn">Evidence gaps: {a.evidenceGaps.join(" ")}</p>}
              </div>
            </div>
          </Card>

          <Card title={<span id="jobs">6 · Current career opportunities</span>} action={<Link href={`/jobs?company=${company.slug}#add`} className="text-xs text-accent hover:underline">+ Add a posting</Link>}>
            {jobs.length ? (
              <ul className="space-y-3">
                {jobs.map((j) => {
                  const m = a.jobMatches.find((x) => x.jobId === j.id);
                  const e = a.eligibility.jobs.find((x) => x.jobId === j.id)?.result;
                  return (
                    <li key={j.id} className="rounded-lg border border-line p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div><p className="font-medium">{j.title}</p><p className="text-xs text-muted">{j.requisition_id ? `${j.requisition_id} · ` : ""}{j.employment_type.replace("_", " ")} · {j.location ?? "Location n/a"}{j.posted_at ? ` · posted ${j.posted_at}` : ""}</p></div>
                        <div className="flex flex-wrap gap-1"><VerificationBadge level={j.verification} />{m && <Badge tone={scoreTone(m.score)}>Match {m.score}</Badge>}{e && <EligibilityBadge status={e.status} />}</div>
                      </div>
                      {j.description && <p className="mt-2 text-sm text-muted">{j.description}</p>}
                      {j.qualifications.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs">{j.qualifications.map((q) => <li key={q}>{q}</li>)}</ul>}
                      <p className="mt-2 text-xs text-muted">Listing status: {j.listing_status} · last checked {fmtDate(j.last_checked_at)}</p>
                      {j.apply_url && <ExtLink href={j.apply_url} className="mt-1 text-sm">Open posting</ExtLink>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty title="No verified postings on file">
                Being at SHPE doesn&apos;t mean {company.name} is hiring for your profile. Check <ExtLink href={company.careers_url ?? company.website ?? "#"}>their careers site</ExtLink>, ask at the booth, and save real postings to the Job Tracker.
              </Empty>
            )}
          </Card>

          <Card title={<span id="eligibility">7 · Work-authorization information</span>} subtitle="Separate from compatibility. Based only on what postings explicitly state and your own settings.">
            <div className="flex items-center gap-2"><EligibilityBadge status={a.eligibility.status} /><span className="text-sm">{a.eligibility.summary}</span></div>
            {a.eligibility.jobs.map((j) => (
              <Disclosure key={j.jobId} summary={<>{j.title}: {ELIGIBILITY_LABEL[j.result.status]}</>}>
                {j.result.requirements.length > 0 && <p className="mb-1 text-xs"><span className="text-muted">Stated requirements:</span> {j.result.requirements.join("; ")}</p>}
                <ul className="list-disc pl-5 text-xs text-muted">{j.result.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              </Disclosure>
            ))}
            {a.eligibility.notes.map((n) => <p key={n} className="mt-2 rounded-lg bg-raised/60 p-2 text-xs"><span className="font-medium">Company context: </span>{n}</p>)}
            <p className="mt-2 text-xs text-muted">One restricted role doesn&apos;t rule out the company. Ask about commercial (non-export-controlled) teams, research collaborations and international sites. Update your status in <Link className="text-accent" href="/profile#preferences">Profile → Preferences</Link>.</p>
          </Card>

          <Card title={<span id="recruiters">8 · Relevant recruiters & contacts</span>} action={<ExtLink href={linkedinPeopleSearch(company.name)} className="text-xs">Search LinkedIn</ExtLink>}>
            {recruiters.length ? (
              <ul className="space-y-3">
                {recruiters.map((r) => (
                  <li key={r.id} className="rounded-lg border border-line p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><p className="font-medium">{r.full_name}</p><p className="text-xs text-muted">{r.title ?? "Title not recorded"}{r.specialization ? ` · ${r.specialization}` : ""}</p></div>
                      <div className="flex gap-1"><Badge tone={r.attendance_status === "confirmed" ? "good" : r.attendance_status === "potential" ? "accent" : "neutral"}>{r.attendance_status === "confirmed" ? "Confirmed attending" : r.attendance_status === "potential" ? "Potential contact" : "Unverified"}</Badge>{r.linkedin_url && <ExtLink href={r.linkedin_url} className="text-xs">LinkedIn</ExtLink>}</div>
                    </div>
                    <div className="mt-2"><RecruiterContactControls recruiterId={r.id} status={r.contact?.status ?? "none"} saved={r.contact?.saved ?? false} notes={r.contact?.notes ?? ""} mutual={r.contact?.mutual_connections ?? ""} /></div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">No recruiters on file. No individual has been publicly confirmed for this company&apos;s booth, and none are invented here. Add people you meet or find on LinkedIn.</p>}
            <Disclosure summary="Add a recruiter or contact"><RecruiterForm companyId={company.id} /></Disclosure>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title={<span id="pitch">9 · Elevator pitch</span>} action={<ComputedLabel />}>
            {([["15 seconds", prep.pitch15], ["30 seconds", prep.pitch30], ["60 seconds", prep.pitch60]] as const).map(([l, t]) => (
              <div key={l} className="mb-3">
                <div className="mb-1 flex items-center justify-between"><span className="label mb-0">{l}</span><CopyButton text={t} className="text-xs text-accent inline-flex items-center gap-1" /></div>
                <p className="rounded-lg bg-raised/60 p-2.5 text-sm leading-relaxed">{t}</p>
              </div>
            ))}
            <AiGenerate aiEnabled={ai} payload={{ task: "pitch", companySlug: company.slug }} label="Polish pitches with AI" />
          </Card>

          <Card title={<span id="talk">10 · Technical talking points</span>}>
            <p className="label">Conversation starters</p>
            <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm">{prep.starters.map((s) => <li key={s}>{s}</li>)}</ol>
            <p className="label">Technical topics</p>
            {prep.talkingPoints.length ? (
              <ul className="space-y-2 text-sm">{prep.talkingPoints.map((t) => <li key={t.topic}><span className="font-medium">{t.topic}.</span> <span className="text-muted">{t.detail}</span></li>)}</ul>
            ) : <p className="text-sm text-muted">Little technical overlap is documented. Lead with your problem-solving and leadership examples.</p>}
          </Card>

          <Card title={<span id="questions">11 · Questions to ask</span>}>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">{prep.questions.map((q) => <li key={q}>{q}</li>)}</ol>
            <div className="mt-3 space-y-2">
              <p className="label">Prepare for tough questions</p>
              {prep.hardQuestions.map((h) => <Disclosure key={h.q} summary={h.q}><p className="leading-relaxed">{h.a}</p><div className="mt-1"><CopyButton text={h.a} className="text-xs text-accent inline-flex items-center gap-1" /></div></Disclosure>)}
            </div>
          </Card>

          <Card title={<span id="booth">12 · Booth location & SHPE evidence</span>}>
            <p className="text-sm">{booth ? <>Booth <span className="text-lg font-semibold">#{booth}</span>, published by the company. Check the official SHPE floor plan for its location in the hall.</> : "No booth number has been published by a source we could verify. Look the company up in the official SHPE app or floor plan."}</p>
            <ul className="mt-3 space-y-2">
              {parts.length ? parts.map((p) => (
                <li key={p.id} className="rounded-lg border border-line p-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-1"><VerificationBadge level={p.verification} /><Badge>{ROLE_LABEL[p.role]}{p.tier ? ` · ${p.tier}` : ""}</Badge><span className="text-muted">{p.event_year}</span></div>
                  <p className="mt-1">{p.evidence}</p>
                  {p.activities.length > 0 && <ul className="mt-1 list-disc pl-4">{p.activities.map((x) => <li key={x}>{x}</li>)}</ul>}
                  {p.source_url && <p className="mt-1"><ExtLink href={p.source_url}>{p.source_title ?? "Source"}</ExtLink></p>}
                  {p.access_note && <p className="mt-1 text-muted">{p.access_note}</p>}
                  <p className="mt-1 text-muted">Checked {fmtDate(p.verified_at)}</p>
                </li>
              )) : <li className="text-sm text-muted">No participation evidence on file.</li>}
            </ul>
          </Card>

          <Card title="13 · LinkedIn links">
            <ul className="space-y-1.5 text-sm">
              <li><ExtLink href={company.linkedin_url ?? linkedinCompanySearch(company.name)}>{company.name} company page</ExtLink></li>
              <li><ExtLink href={linkedinPeopleSearch(company.name, "university recruiter")}>University recruiters</ExtLink></li>
              <li><ExtLink href={linkedinPeopleSearch(company.name, "talent acquisition engineering")}>Engineering talent acquisition</ExtLink></li>
              <li><ExtLink href={linkedinPeopleSearch(company.name, "additive manufacturing engineer")}>Additive manufacturing engineers</ExtLink></li>
              <li><ExtLink href={linkedinPeopleSearch(company.name, "SHPE")}>Employees mentioning SHPE</ExtLink></li>
              {recruiters.filter((r) => r.linkedin_url).map((r) => <li key={r.id}><ExtLink href={r.linkedin_url!}>{r.full_name}</ExtLink></li>)}
            </ul>
            <p className="mt-2 text-xs text-muted">These are LinkedIn searches that open in your own LinkedIn session. Mutual connections show there. Record them below; this app can&apos;t read your network.</p>
          </Card>

          <Card title={<span id="notes">14 · Networking notes & follow-up</span>}>
            <div className="space-y-4">
              <Disclosure summary="Log an interaction" defaultOpen={Boolean(track?.visited_at) && interactions.length === 0}><InteractionForm companyId={company.id} recruiters={recruiters.map((r) => ({ id: r.id, full_name: r.full_name }))} /></Disclosure>
              {interactions.length > 0 && (
                <div><p className="label">Interaction history</p>
                  <ul className="space-y-2 text-sm">{interactions.map((i) => <li key={i.id} className="rounded-lg bg-raised/50 p-2"><p className="text-xs text-muted">{new Date(i.occurred_at).toLocaleString()} · {i.kind.replace("_", " ")}{i.recruiter_name ? ` · ${i.recruiter_name}` : ""}</p><p>{i.summary}</p>{i.opportunities_discussed && <p className="text-xs">Opportunities: {i.opportunities_discussed}</p>}</li>)}</ul>
                </div>
              )}
              <div><p className="label">Follow-up tasks</p><TaskList tasks={companyTasks} /><div className="mt-2"><AddTaskForm companyId={company.id} /></div></div>
              <div><p className="label">Private notes</p><NoteForm entityType="company" entityId={company.id} /><ul className="divide-y divide-line">{notes.map((n) => <NoteItem key={n.id} id={n.id} body={n.body} createdAt={String(n.created_at)} />)}</ul></div>
              {track && track.status !== "none" && <p className="text-xs text-muted">Current status: {CRM_LABEL[track.status]}</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
