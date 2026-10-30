import { PageHeader } from "@/components/ui";
import { CompanyExplorer, type ExplorerRow } from "./explorer";
import { bestParticipation, boothOf, getWorkspace } from "@/lib/repo";
import { DOMAIN_BY_KEY, type DomainKey } from "@/lib/taxonomy";

export const metadata = { title: "Company Explorer" };

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ws = await getWorkspace();
  const rows: ExplorerRow[] = ws.companies.map((c) => {
    const a = ws.assessments.get(c.id)!;
    const parts = ws.participation.get(c.id) ?? [];
    const p = bestParticipation(parts);
    const jobs = ws.jobs.get(c.id) ?? [];
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      domain: c.domain,
      industry: c.industry,
      industries: c.industries,
      headquarters: c.headquarters ?? "",
      description: c.description ?? "",
      score: a.score,
      confidence: a.confidence,
      priorityTier: a.priority.tier,
      priorityLabel: a.priority.label,
      opportunities: a.factors.find((f) => f.key === "opportunities")!.score,
      verification: p?.verification ?? "none",
      role: p?.role ?? null,
      tier: p?.tier ?? null,
      booth: boothOf(parts),
      eligibility: a.eligibility.status,
      sponsorshipKnown: jobs.some((j) => j.eligibility && j.eligibility.sponsorship !== "unknown"),
      jobTypes: [...new Set(jobs.map((j) => j.employment_type))],
      jobCount: jobs.length,
      domains: (Object.keys(c.tech_tags) as DomainKey[]).filter((k) => (c.tech_tags[k]?.weight ?? 0) >= 2),
      topMatch: a.matchedDomains.slice(0, 2).map((m) => m.label),
      status: ws.tracking.get(c.id)?.status ?? "none",
      saved: ws.tracking.get(c.id)?.saved ?? false,
      visited: Boolean(ws.tracking.get(c.id)?.visited_at),
    };
  });
  const domainOptions = [...new Set(rows.flatMap((r) => r.domains))].map((k) => ({ key: k, label: DOMAIN_BY_KEY[k].label })).sort((a, b) => a.label.localeCompare(b.label));
  return (
    <>
      <PageHeader
        title="Company Explorer"
        subtitle="Every company in your research database, ranked against your profile. Verification badges show how SHPE 2026 participation was confirmed; open a company for the evidence and source."
      />
      <CompanyExplorer rows={rows} domainOptions={domainOptions} initial={{ q: sp.q ?? "", verification: sp.verification ?? "" }} />
    </>
  );
}
