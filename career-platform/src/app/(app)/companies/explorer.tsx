"use client";

import Link from "@/components/link";
import { useMemo, useState, useTransition } from "react";
import { Bookmark, BookmarkCheck, Footprints, SlidersHorizontal } from "lucide-react";
import { Badge, ConfidenceBadge, EligibilityBadge, ScoreRing, VerificationBadge, ROLE_LABEL, Empty } from "@/components/ui";
import { CompanyLogo } from "@/components/client";
import { updateCompanyTracking } from "@/app/actions";
import type { EligibilityStatus } from "@/lib/eligibility";
import { CRM_LABEL, type CrmStatus } from "@/lib/types";
import type { DomainKey } from "@/lib/taxonomy";

export interface ExplorerRow {
  id: string; slug: string; name: string; domain: string | null; industry: string; industries: string[]; headquarters: string;
  description: string; score: number; confidence: "high" | "medium" | "low"; priorityTier: number; priorityLabel: string;
  opportunities: number; verification: "verified" | "partially_verified" | "unverified" | "none"; role: string | null; tier: string | null;
  booth: string | null; eligibility: EligibilityStatus; sponsorshipKnown: boolean; jobTypes: string[]; jobCount: number;
  domains: DomainKey[]; topMatch: string[]; status: CrmStatus; saved: boolean; visited: boolean;
}

const JOB_TYPES = [["internship", "Internship"], ["co_op", "Co-op"], ["full_time", "Full-time"], ["research", "Research"], ["development_program", "Development program"]];

export function CompanyExplorer({ rows, domainOptions, initial }: { rows: ExplorerRow[]; domainOptions: { key: string; label: string }[]; initial: { q: string; verification: string } }) {
  const [q, setQ] = useState(initial.q);
  const [industry, setIndustry] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [domain, setDomain] = useState("");
  const [jobType, setJobType] = useState("");
  const [location, setLocation] = useState("");
  const [elig, setElig] = useState("");
  const [sponsorship, setSponsorship] = useState(false);
  const [booth, setBooth] = useState("");
  const [verification, setVerification] = useState(initial.verification);
  const [priority, setPriority] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [sort, setSort] = useState("score");
  const [showFilters, setShowFilters] = useState(false);
  const [local, setLocal] = useState<Record<string, Partial<ExplorerRow>>>({});
  const [, start] = useTransition();

  const industries = useMemo(() => [...new Set(rows.flatMap((r) => r.industries))].sort(), [rows]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.map((r) => ({ ...r, ...local[r.id] })).filter((r) =>
      (!needle || [r.name, r.industry, r.description, r.headquarters, r.booth ?? "", ...r.topMatch, ...r.industries].join(" ").toLowerCase().includes(needle)) &&
      (!industry || r.industries.includes(industry)) &&
      r.score >= minScore &&
      (!domain || r.domains.includes(domain as DomainKey)) &&
      (!jobType || r.jobTypes.includes(jobType)) &&
      (!location || r.headquarters.toLowerCase().includes(location.toLowerCase())) &&
      (!elig || r.eligibility === elig) &&
      (!sponsorship || r.sponsorshipKnown) &&
      (!booth || (booth === "has" ? !!r.booth : (r.booth ?? "").includes(booth))) &&
      (!verification || r.verification === verification) &&
      (!priority || String(r.priorityTier) === priority) &&
      (!savedOnly || r.saved));
    const cmp: Record<string, (a: ExplorerRow, b: ExplorerRow) => number> = {
      score: (a, b) => b.score - a.score,
      name: (a, b) => a.name.localeCompare(b.name),
      industry: (a, b) => a.industry.localeCompare(b.industry) || b.score - a.score,
      opportunities: (a, b) => b.jobCount - a.jobCount || b.opportunities - a.opportunities,
      booth: (a, b) => (a.booth ? Number(a.booth) : 1e9) - (b.booth ? Number(b.booth) : 1e9),
    };
    return out.sort(cmp[sort]);
  }, [rows, local, q, industry, minScore, domain, jobType, location, elig, sponsorship, booth, verification, priority, savedOnly, sort]);

  const toggleSave = (r: ExplorerRow) => {
    setLocal((l) => ({ ...l, [r.id]: { ...l[r.id], saved: !r.saved } }));
    start(async () => { await updateCompanyTracking(r.id, { saved: !r.saved }); });
  };
  const markVisited = (r: ExplorerRow) => {
    setLocal((l) => ({ ...l, [r.id]: { ...l[r.id], visited: !r.visited } }));
    start(async () => { await updateCompanyTracking(r.id, { visited: !r.visited }); });
  };
  const reset = () => { setQ(""); setIndustry(""); setMinScore(0); setDomain(""); setJobType(""); setLocation(""); setElig(""); setSponsorship(false); setBooth(""); setVerification(""); setPriority(""); setSavedOnly(false); };

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, technology, industry, booth…" className="input text-base sm:text-sm" aria-label="Search companies" />
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="input sm:w-56" aria-label="Sort">
            <option value="score">Sort: Compatibility</option>
            <option value="name">Sort: Company name</option>
            <option value="industry">Sort: Industry</option>
            <option value="opportunities">Sort: Career opportunities</option>
            <option value="booth">Sort: Booth number</option>
          </select>
          <button className="btn-ghost" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}><SlidersHorizontal className="h-4 w-4" /> Filters</button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
            <Sel label="Industry" value={industry} onChange={setIndustry} options={industries.map((i) => [i, i])} />
            <Sel label="Engineering specialty" value={domain} onChange={setDomain} options={domainOptions.map((d) => [d.key, d.label])} />
            <Sel label="Job type (postings on file)" value={jobType} onChange={setJobType} options={JOB_TYPES} />
            <Sel label="Eligibility" value={elig} onChange={setElig} options={[["confirmed_eligible", "Confirmed eligible"], ["potentially_eligible", "Potentially eligible"], ["requires_clarification", "Requires clarification"], ["explicit_restriction", "Explicit restriction"], ["insufficient_information", "Insufficient information"]]} />
            <Sel label="Participation" value={verification} onChange={setVerification} options={[["verified", "Verified"], ["partially_verified", "Partially verified"], ["unverified", "Unverified"], ["none", "No 2026 evidence"]]} />
            <Sel label="Networking priority" value={priority} onChange={setPriority} options={[["1", "Tier 1"], ["2", "Tier 2"], ["3", "Tier 3"], ["4", "Low"]]} />
            <label><span className="label">Min score: {minScore}</span><input type="range" min={0} max={90} step={5} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="w-full accent-[rgb(var(--accent))]" /></label>
            <label><span className="label">HQ location</span><input value={location} onChange={(e) => setLocation(e.target.value)} className="input" placeholder="e.g. Ohio" /></label>
            <label><span className="label">Booth</span><input value={booth === "has" ? "" : booth} onChange={(e) => setBooth(e.target.value)} className="input" placeholder="Booth #" /></label>
            <label className="flex items-center gap-2 pt-5 text-sm"><input type="checkbox" checked={booth === "has"} onChange={(e) => setBooth(e.target.checked ? "has" : "")} /> Booth published</label>
            <label className="flex items-center gap-2 pt-5 text-sm"><input type="checkbox" checked={sponsorship} onChange={(e) => setSponsorship(e.target.checked)} /> Visa-sponsorship info on file</label>
            <label className="flex items-center gap-2 pt-5 text-sm"><input type="checkbox" checked={savedOnly} onChange={(e) => setSavedOnly(e.target.checked)} /> Saved only</label>
            <button className="btn-ghost col-span-2 md:col-span-1" onClick={reset}>Reset filters</button>
          </div>
        )}
        <p className="text-xs text-muted">{filtered.length} of {rows.length} companies</p>
      </div>

      {filtered.length === 0 ? (
        <Empty title="No companies match these filters" action={<button className="btn-ghost" onClick={reset}>Reset filters</button>}>Try a broader search, or import a verified exhibitor list on the Data & Sources page.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <article key={r.id} className="card flex flex-col p-4 transition hover:border-accent/60">
              <div className="flex items-start gap-3">
                <CompanyLogo name={r.name} domain={r.domain} />
                <div className="min-w-0 flex-1">
                  <Link href={`/companies/${r.slug}`} className="block truncate font-semibold hover:text-accent">{r.name}</Link>
                  <p className="truncate text-xs text-muted">{r.industry}{r.headquarters ? ` · ${r.headquarters}` : ""}</p>
                </div>
                <ScoreRing score={r.score} size={48} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {r.verification !== "none" ? <VerificationBadge level={r.verification} title={r.role ? ROLE_LABEL[r.role] : undefined} /> : <Badge>No 2026 evidence</Badge>}
                {r.role && <Badge>{ROLE_LABEL[r.role]}{r.tier ? ` · ${r.tier}` : ""}</Badge>}
                {r.booth && <Badge tone="accent">Booth #{r.booth}</Badge>}
                <Badge tone={r.priorityTier === 1 ? "good" : r.priorityTier === 2 ? "accent" : "neutral"}>{r.priorityLabel}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted">{r.description}</p>
              {r.topMatch.length > 0 && <p className="mt-2 text-xs"><span className="text-muted">Your match: </span>{r.topMatch.join(" · ")}</p>}
              <div className="mt-2 flex flex-wrap gap-1">
                <EligibilityBadge status={r.eligibility} />
                <ConfidenceBadge level={r.confidence} />
                {r.jobCount > 0 && <Badge tone="info">{r.jobCount} posting{r.jobCount > 1 ? "s" : ""}</Badge>}
                {r.status !== "none" && <Badge tone="accent">{CRM_LABEL[r.status]}</Badge>}
              </div>
              <div className="mt-auto flex gap-2 pt-3">
                <Link href={`/companies/${r.slug}`} className="btn-primary flex-1">Open profile</Link>
                <button className="btn-ghost" onClick={() => toggleSave(r)} aria-pressed={r.saved} aria-label={r.saved ? "Unsave company" : "Save company"} title={r.saved ? "Saved" : "Save"}>
                  {r.saved ? <BookmarkCheck className="h-4 w-4 text-accent" /> : <Bookmark className="h-4 w-4" />}
                </button>
                <button className="btn-ghost" onClick={() => markVisited(r)} aria-pressed={r.visited} title={r.visited ? "Visited" : "Mark booth visited"} aria-label="Toggle booth visited">
                  <Footprints className={`h-4 w-4 ${r.visited ? "text-good" : ""}`} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <label>
      <span className="label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input">
        <option value="">All</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
