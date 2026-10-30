import { Badge, Card, ExtLink, PageHeader, fmtDate, VerificationBadge } from "@/components/ui";
import { q } from "@/lib/db";
import { getWorkspace } from "@/lib/repo";
import { EVENT } from "@/lib/event";
import dataset from "../../../../data/shpe2026-dataset.json";
import { ImportForm } from "./client";

export const metadata = { title: "Data & Sources" };

const CSV_TEMPLATE = `name,industry,headquarters,website,careers_url,role,tier,booth_number,verification,evidence,source_url,source_type,tags
"Example Aerospace Co","Aerospace & Defense","City, ST",https://example.com,https://example.com/careers,exhibitor,,1234,verified,"Listed on the official SHPE 2026 exhibitor directory",https://shpe.org/...,official_shpe,additive_manufacturing|superalloys_high_temp`;

export default async function DataPage() {
  const ws = await getWorkspace();
  const [sources, imports] = await Promise.all([
    q<{ id: string; url: string; title: string; publisher: string | null; source_type: string; accessed_at: string; access_note: string | null; uses: number }>(`
      select s.id, s.url, s.title, s.publisher, s.source_type, to_char(s.accessed_at,'YYYY-MM-DD') as accessed_at, s.access_note,
        ((select count(*) from convention_participation p where p.source_id=s.id) + (select count(*) from jobs j where j.source_id=s.id))::int as uses
      from sources s order by s.source_type, s.title`),
    q<{ kind: string; filename: string | null; summary: { companies: number; jobs: number; recruiters: number; warnings: string[] }; created_at: string }>(`select kind, filename, summary, created_at from data_imports order by created_at desc limit 20`),
  ]);
  const counts = { verified: 0, partially_verified: 0, unverified: 0, none: 0 };
  for (const c of ws.companies) {
    const parts = (ws.participation.get(c.id) ?? []).filter((p) => p.event_year === 2026 && p.role !== "historical");
    const best = parts.find((p) => p.verification === "verified") ?? parts.find((p) => p.verification === "partially_verified") ?? parts[0];
    counts[best?.verification ?? "none"]++;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Data & Sources" subtitle="Where every fact comes from, how confident it is, and how to refresh it." />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Research snapshot" className="lg:col-span-2">
          <p className="text-sm">{(dataset as { notes: string }).notes}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Badge tone="good">{counts.verified} verified 2026 participants</Badge>
            <Badge tone="warn">{counts.partially_verified} partially verified</Badge>
            <Badge>{counts.unverified + counts.none} unverified / no 2026 evidence</Badge>
            <Badge tone="info">{[...ws.jobs.values()].flat().length} job postings</Badge>
            <Badge>{ws.recruiters.length} recruiters</Badge>
          </div>
          <div className="mt-4 rounded-lg bg-raised/50 p-3 text-sm">
            <p className="font-medium">Event facts</p>
            <p className="text-muted">{EVENT.dates} · {EVENT.venue}. Career fair: {EVENT.career_fair.map((f) => `${f.day} ${f.hours}`).join("; ")} <VerificationBadge level={EVENT.career_fair_verification} /> (<ExtLink href={EVENT.career_fair_source}>source</ExtLink>)</p>
            <p className="mt-1 text-xs text-muted">{EVENT.scale_note}</p>
          </div>
          <div className="mt-4 text-sm">
            <p className="font-medium">Confidence system</p>
            <ul className="mt-1 space-y-1 text-muted">
              <li><VerificationBadge level="verified" /> directly supported by an authoritative source (official SHPE or company page)</li>
              <li><VerificationBadge level="partially_verified" /> credible but incomplete evidence (e.g., SHPE partner list, news article, aggregator)</li>
              <li><VerificationBadge level="unverified" /> insufficient confirmation</li>
              <li><VerificationBadge level="ai_analysis" /> interpretation or recommendation, not an established fact</li>
            </ul>
          </div>
        </Card>
        <Card title="Import verified data" subtitle="JSON (dataset format) or CSV, max 5 MB. Imports are validated and upserted, never blindly overwritten.">
          <ImportForm />
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer font-medium">CSV template</summary>
            <pre className="mt-2 overflow-x-auto rounded bg-raised p-2 text-[10px]">{CSV_TEMPLATE}</pre>
            <p className="mt-1 text-muted">Required: name, industry, verification, evidence. Tags use the engineering-domain keys (see <code>src/lib/taxonomy.ts</code>), separated by |.</p>
          </details>
          <p className="mt-3 text-xs text-muted">
            Refresh workflow: when the official SHPE exhibitor list or floor plan is available (SHPE app or shpe.org), export or transcribe it to CSV, include the source URL, and import it here. The app doesn&apos;t scrape sites, which would break their access terms. Scheduled refreshes need an authorized feed; none is available.
          </p>
        </Card>
      </div>

      <Card title={`Sources (${sources.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-muted"><tr><th className="py-2">Source</th><th>Type</th><th>Accessed</th><th>Used by</th><th>Notes</th></tr></thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="border-t border-line align-top">
                  <td className="py-2 pr-3"><ExtLink href={s.url}>{s.title}</ExtLink>{s.publisher && <p className="text-xs text-muted">{s.publisher}</p>}</td>
                  <td className="pr-3"><Badge>{s.source_type.replace("_", " ")}</Badge></td>
                  <td className="pr-3 text-xs">{fmtDate(s.accessed_at)}</td>
                  <td className="pr-3 text-xs">{s.uses} record(s)</td>
                  <td className="text-xs text-muted">{s.access_note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Import history">
        <ul className="space-y-1 text-sm">
          {imports.map((i, idx) => (
            <li key={idx}>{new Date(i.created_at).toLocaleString()} · {i.kind} · {i.filename} · {i.summary.companies} companies, {i.summary.jobs} jobs, {i.summary.recruiters} recruiters{i.summary.warnings?.length ? <span className="text-warn"> · {i.summary.warnings.length} warning(s)</span> : null}</li>
          ))}
        </ul>
      </Card>

      <Card title="Known limitations of this snapshot">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>The official SHPE exhibitor directory, floor plan and Attendee Hub could not be retrieved, so most companies lack booth numbers.</li>
          <li>SHPE Industry Partnership Council membership comes from partial search-index captures. It shows partnership, not a 2026 booth.</li>
          <li>No individual recruiter was publicly confirmed as attending, so the recruiter directory starts empty by design.</li>
          <li>Only three job postings were captured, two of them from third-party aggregators. Confirm status on official career sites.</li>
          <li>Company engineering descriptions summarize long-standing public information and are marked partially verified.</li>
        </ul>
      </Card>
    </div>
  );
}
