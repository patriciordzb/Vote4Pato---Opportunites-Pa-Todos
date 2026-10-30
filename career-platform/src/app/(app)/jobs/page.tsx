import Link from "@/components/link";
import { Badge, Card, EligibilityBadge, ExtLink, PageHeader, VerificationBadge, Empty, scoreTone, fmtDate } from "@/components/ui";
import { JobForm } from "@/components/forms";
import { getWorkspace, listApplications } from "@/lib/repo";
import { assessJob } from "@/lib/eligibility";
import { matchJob } from "@/lib/scoring";
import { ApplicationRow, JobActions, ResumeMatch } from "./client";

export const metadata = { title: "Job Opportunity Tracker" };

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const { company: companySlug } = await searchParams;
  const ws = await getWorkspace();
  const apps = await listApplications(ws.userId);
  const jobs = [...ws.jobs.values()].flat()
    .map((j) => ({ j, m: matchJob(j, ws.intel, ws.profile.preferences), e: assessJob(j.eligibility, ws.profile.preferences) }))
    .sort((a, b) => b.m.score - a.m.score);
  const companies = ws.companies.map((c) => ({ id: c.id, name: c.name }));
  const preselect = companySlug ? ws.companies.find((c) => c.slug === companySlug)?.id : undefined;
  const appliedJobIds = new Set(apps.map((a) => a.job_id));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Job Opportunity Tracker"
        subtitle="Only real postings appear here, from the research snapshot or added by you from official listings. Match scores compare each posting with your profile. Eligibility reflects only what the posting states."
      />

      <Card title={`Postings on file (${jobs.length})`}>
        {jobs.length === 0 ? <Empty title="No postings yet">Add postings from company career sites below.</Empty> : (
          <div className="space-y-3">
            {jobs.map(({ j, m, e }) => (
              <div key={j.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{j.title}</p>
                    <p className="text-xs text-muted"><Link className="hover:text-accent" href={`/companies/${j.company_slug}`}>{j.company_name}</Link> · {j.location ?? "Location n/a"} · {j.employment_type.replace("_", " ")}{j.requisition_id ? ` · ${j.requisition_id}` : ""}{j.deadline ? ` · deadline ${j.deadline}` : ""}{j.salary ? ` · ${j.salary}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={scoreTone(m.score)}>Match {m.score}/100</Badge>
                    <EligibilityBadge status={e.status} />
                    <VerificationBadge level={j.verification} />
                    <Badge>Listing: {j.listing_status}</Badge>
                  </div>
                </div>
                {j.qualifications.length > 0 && <p className="mt-2 text-xs"><span className="text-muted">Qualifications: </span>{j.qualifications.join(" · ")}</p>}
                {m.matched.length > 0 && <p className="mt-1 text-xs text-good">Matching: {m.matched.join(", ")}</p>}
                {m.missing.length > 0 && <p className="mt-1 text-xs text-warn">Check / missing: {m.missing.join(", ")}</p>}
                {e.requirements.length > 0 && <p className="mt-1 text-xs"><span className="text-muted">Stated eligibility: </span>{e.requirements.join("; ")}</p>}
                {j.eligibility?.note && <p className="mt-1 text-xs text-muted">{j.eligibility.note}</p>}
                <p className="mt-1 text-xs text-muted">Last checked {fmtDate(j.last_checked_at)}{j.source_url && j.source_url !== j.apply_url ? <> · <ExtLink href={j.source_url}>source</ExtLink></> : null}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {j.apply_url && <a href={j.apply_url} target="_blank" rel="noopener noreferrer" className="btn-primary">Open posting</a>}
                  <JobActions jobId={j.id} saved={appliedJobIds.has(j.id)} listingStatus={j.listing_status} />
                  <ResumeMatch jobId={j.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={`My applications (${apps.length})`} subtitle="Statuses sync with the Networking CRM">
        {apps.length === 0 ? <p className="text-sm text-muted">Save a posting above or add one below to start tracking.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-muted"><tr><th className="py-2">Position</th><th>Company</th><th>Status</th><th>Applied</th><th>Notes</th><th /></tr></thead>
              <tbody>{apps.map((a) => <ApplicationRow key={a.id} app={a} />)}</tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={<span id="add">Add a job posting</span>} subtitle="Paste details from the official posting. Entries with an application link are marked 'partially verified'; without one, 'unverified'.">
        <JobForm companies={companies} companyId={preselect} />
      </Card>
    </div>
  );
}
