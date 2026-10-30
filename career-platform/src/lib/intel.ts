import { DOMAINS, DOMAIN_BY_KEY, detectDomains, type DomainKey } from "./taxonomy";
import type { ProfileData } from "./types";

// "Professional intelligence profile": turns the approved profile into
// per-domain strength scores with the specific evidence behind each one.

export type EvidenceKind = "research" | "publication" | "experience" | "project" | "skill" | "certification" | "leadership";

const KIND_WEIGHT: Record<EvidenceKind, number> = {
  research: 1.0,
  publication: 0.8,
  experience: 0.8,
  project: 0.7,
  certification: 0.6,
  skill: 0.5,
  leadership: 0.5,
};

const RESEARCH_KINDS: EvidenceKind[] = ["research", "publication", "project"];

export interface EvidenceItem { kind: EvidenceKind; label: string; text: string }
export interface DomainStrength { key: DomainKey; strength: number; evidence: EvidenceItem[] }

export interface ProfileIntel {
  skills: Map<DomainKey, DomainStrength>;
  research: Map<DomainKey, DomainStrength>;
  topStrengths: DomainStrength[];
  gaps: { key: DomainKey; reason: string }[];
  transferable: string[];
  careerPaths: { title: string; why: string; domains: DomainKey[] }[];
  completeness: { score: number; missing: string[] };
}

export function evidenceItems(p: ProfileData): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  for (const r of p.research ?? []) {
    items.push({ kind: "research", label: `Research: ${shorten(r.title)}`, text: [r.title, r.question, ...(r.methods ?? []), ...(r.keyFindings ?? []), ...(r.nextSteps ?? [])].join(" ") });
  }
  for (const pub of p.publications ?? []) items.push({ kind: "publication", label: `Publication: ${shorten(pub.title)}`, text: `${pub.title} ${pub.venue ?? ""}` });
  for (const e of p.experience ?? []) items.push({ kind: "experience", label: `${e.role.split("—")[0].trim()} at ${e.org}`, text: `${e.role} ${e.org} ${e.bullets.join(" ")}` });
  for (const pr of p.projects ?? []) items.push({ kind: "project", label: `Project: ${pr.name}`, text: `${pr.name} ${pr.bullets.join(" ")}` });
  for (const g of p.skillGroups ?? []) for (const s of g.items) items.push({ kind: "skill", label: `Skill: ${s}`, text: s });
  for (const c of p.certifications ?? []) items.push({ kind: "certification", label: `Certification: ${c}`, text: c });
  for (const l of p.leadership ?? []) items.push({ kind: "leadership", label: `${l.role}, ${l.org}`, text: `${l.role} ${l.org} ${l.bullets.join(" ")}` });
  return items;
}

function shorten(s: string, n = 70) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function accumulate(items: EvidenceItem[]): Map<DomainKey, DomainStrength> {
  const raw = new Map<DomainKey, { score: number; evidence: EvidenceItem[] }>();
  for (const it of items) {
    const found = detectDomains(it.text);
    for (const [key] of found) {
      const cur = raw.get(key) ?? { score: 0, evidence: [] };
      cur.score += KIND_WEIGHT[it.kind];
      cur.evidence.push(it);
      raw.set(key, cur);
    }
  }
  const out = new Map<DomainKey, DomainStrength>();
  for (const [key, v] of raw) {
    // Saturates: ~2.5 weighted pieces of evidence = full strength.
    const strength = Math.min(1, v.score / 2.5);
    const evidence = [...v.evidence].sort((a, b) => KIND_WEIGHT[b.kind] - KIND_WEIGHT[a.kind]);
    out.set(key, { key, strength, evidence });
  }
  return out;
}

const CAREER_PATHS: { title: string; domains: DomainKey[] }[] = [
  { title: "Additive manufacturing / materials & process engineer (aerospace propulsion)", domains: ["additive_manufacturing", "lpbf", "superalloys_high_temp", "heat_treatment_hip", "am_qualification_standards"] },
  { title: "Materials characterization & test engineer", domains: ["mechanical_testing", "materials_characterization", "ndt_metrology"] },
  { title: "Manufacturing engineer (aerospace, energy, heavy industry)", domains: ["manufacturing_engineering", "process_optimization", "machining_cnc", "metals_processing", "cad_design"] },
  { title: "Mechanical design engineer (propulsion & turbomachinery hardware)", domains: ["cad_design", "simulation_fea", "propulsion_turbomachinery"] },
  { title: "Graduate researcher in metal AM / high-temperature materials", domains: ["research_development", "lpbf", "superalloys_high_temp", "mechanical_testing"] },
  { title: "Semiconductor equipment / process engineer", domains: ["process_optimization", "materials_characterization", "ndt_metrology", "cad_design"] },
];

export function analyzeProfile(p: ProfileData): ProfileIntel {
  const items = evidenceItems(p);
  const skills = accumulate(items);
  const research = accumulate(items.filter((i) => RESEARCH_KINDS.includes(i.kind)));

  const topStrengths = [...skills.values()]
    .filter((d) => d.key !== "research_development")
    .sort((a, b) => b.strength - a.strength || b.evidence.length - a.evidence.length)
    .slice(0, 8);

  const careerPaths = CAREER_PATHS.map((cp) => {
    const s = cp.domains.reduce((acc, d) => acc + (skills.get(d)?.strength ?? 0), 0) / cp.domains.length;
    const backed = cp.domains.filter((d) => (skills.get(d)?.strength ?? 0) >= 0.4).map((d) => DOMAIN_BY_KEY[d].label);
    return { title: cp.title, s, domains: cp.domains, why: backed.length ? `Backed by: ${backed.join(", ")}` : "Limited direct evidence yet" };
  }).sort((a, b) => b.s - a.s).slice(0, 4).map(({ title, why, domains }) => ({ title, why, domains }));

  // Gaps: domains common in the user's target industries with little evidence.
  const gapCandidates: { key: DomainKey; reason: string }[] = [
    { key: "simulation_fea", reason: "Listed as a skill, but no project shows FEA or CFD results. Add a sentence on an analysis you ran in ANSYS or HyperWorks." },
    { key: "process_optimization", reason: "Few quantified process-improvement results (DOE, SPC, Six Sigma). Your Minitab skill and the $250K Vinton Steel result are good anchors." },
    { key: "ndt_metrology", reason: "XCT and NDT are listed. One concrete inspection result (e.g., porosity found by CT) would strengthen it." },
    { key: "aerospace_systems", reason: "Strong at the material and part level; less evidence at the system or integration level." },
    { key: "software_data", reason: "Python, MATLAB and SQL are listed. Show them applied, for example automated tensile-data processing." },
  ];
  const gaps = gapCandidates.filter((g) => (skills.get(g.key)?.strength ?? 0) < 0.6);

  const transferable = [
    skills.has("mechanical_testing") && "Experimental design and statistical treatment of mechanical test data transfers to any qualification, reliability or test-engineering role.",
    skills.has("materials_characterization") && "Microscopy and EBSD skills transfer to failure analysis in semiconductors, medical devices and automotive.",
    skills.has("am_qualification_standards") && "Machine-to-machine variability work maps directly to production qualification and supplier quality.",
    skills.has("technical_leadership") && "Founding and running a 24-person R&D lab with external funding shows program management and technical leadership.",
    skills.has("metals_processing") && "Steel-plant design experience (Vinton Steel) shows you can deliver cost-saving hardware in a production environment.",
  ].filter(Boolean) as string[];

  const missing: string[] = [];
  if (!p.summary) missing.push("Professional summary");
  if (!p.research?.length) missing.push("Research");
  if (!p.experience?.length) missing.push("Experience");
  if ((p.skillGroups ?? []).reduce((n, g) => n + g.items.length, 0) < 5) missing.push("Skills");
  if (!p.linkedinUrl) missing.push("LinkedIn URL");
  if (!p.education?.length) missing.push("Education");
  const completeness = { score: Math.round(100 * (6 - missing.length) / 6), missing };

  return { skills, research, topStrengths, gaps, transferable, careerPaths, completeness };
}

export function domainLabel(k: DomainKey) {
  return DOMAIN_BY_KEY[k]?.label ?? k;
}

export function profileToText(p: ProfileData): string {
  const lines: string[] = [];
  lines.push(`${p.fullName} — ${p.headline ?? ""}`);
  if (p.summary) lines.push(p.summary);
  for (const e of p.education) lines.push(`Education: ${e.degree}${e.minor ? `, minor ${e.minor}` : ""}, ${e.school} (expected ${e.expectedGraduation ?? "n/a"}). Honors: ${(e.honors ?? []).join("; ")}`);
  for (const e of p.experience) lines.push(`Experience: ${e.role} — ${e.org} (${e.start ?? ""}–${e.end ?? ""}): ${e.bullets.join(" ")}`);
  for (const r of p.research) lines.push(`Research: ${r.title}. Question: ${r.question ?? ""}. Methods: ${r.methods.join("; ")}. Findings: ${r.keyFindings.join("; ")}`);
  for (const pr of p.projects) lines.push(`Project: ${pr.name}: ${pr.bullets.join(" ")}`);
  for (const pub of p.publications) lines.push(`Publication: ${pub.title} (${pub.venue ?? ""}, ${pub.role ?? ""})`);
  for (const l of p.leadership) lines.push(`Leadership: ${l.role}, ${l.org}: ${l.bullets.join(" ")}`);
  for (const g of p.skillGroups) lines.push(`Skills — ${g.name}: ${g.items.join(", ")}`);
  if (p.certifications.length) lines.push(`Certifications: ${p.certifications.join(", ")}`);
  return lines.join("\n");
}

export const ALL_DOMAINS = DOMAINS;
