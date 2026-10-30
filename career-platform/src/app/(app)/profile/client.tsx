"use client";

import { useFormAction } from "@/components/use-form-action";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { applyDocumentSuggestions, dismissDocumentSuggestions, saveProfileJson, savePreferences } from "@/app/actions";
import { INDUSTRY_OPTIONS } from "@/lib/taxonomy";
import type { Preferences, ProfileData } from "@/lib/types";

const KINDS = [["resume", "Resume"], ["linkedin_pdf", "LinkedIn profile PDF"], ["poster", "Research poster"], ["portfolio", "Portfolio"], ["publication", "Publication"], ["other", "Other"]];

export function DocumentUpload() {
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  return (
    <form ref={ref} className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={async (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const file = fd.get("file");
      if (!(file instanceof File) || !file.size) return setMsg({ ok: false, text: "Choose a PDF first" });
      if (file.size > 10 * 1024 * 1024) return setMsg({ ok: false, text: "File is larger than 10 MB" });
      setPending(true); setMsg(null);
      try {
        const res = await fetch("/api/documents", { method: "POST", body: fd });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "Upload failed");
        setMsg({ ok: true, text: `Uploaded and analyzed (${j.analysis.method === "ai" ? "AI" : "rule-based"}). Review suggestions below.` });
        ref.current?.reset();
        router.refresh();
      } catch (err) {
        setMsg({ ok: false, text: err instanceof Error ? err.message : "Upload failed" });
      } finally { setPending(false); }
    }}>
      <label><span className="label">Type</span><select name="kind" className="input">{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label className="flex-1"><span className="label">PDF file</span><input name="file" type="file" accept="application/pdf,.pdf" required className="input file:mr-3 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-accent-fg" /></label>
      <button className="btn-primary" disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload</button>
      {msg && <p className={`text-xs ${msg.ok ? "text-good" : "text-bad"}`} role="status">{msg.text}</p>}
    </form>
  );
}

interface DocAnalysis { method: string; domains: { label: string; hits: number }[]; suggestions: { skills: string[]; publications: string[]; experience: { org: string; role: string; bullets: string[] }[]; summary?: string }; notes: string[] }

export function DocumentRow({ doc }: { doc: { id: string; kind: string; filename: string; size_bytes: number; created_at: string; review_status: string; has_text: boolean; analysis: unknown } }) {
  const a = doc.analysis as DocAnalysis | null;
  const [skills, setSkills] = useState<Set<string>>(new Set(a?.suggestions.skills ?? []));
  const [pubs, setPubs] = useState<Set<string>>(new Set());
  const [exp, setExp] = useState<Set<number>>(new Set());
  const [useSummary, setUseSummary] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  const toggle = <T,>(set: Set<T>, v: T, fn: (s: Set<T>) => void) => { const n = new Set(set); if (n.has(v)) n.delete(v); else n.add(v); fn(n); };
  const hasSuggestions = a && (a.suggestions.skills.length || a.suggestions.publications.length || a.suggestions.experience.length || a.suggestions.summary);

  return (
    <li className="rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a href={`/api/documents/${doc.id}`} target="_blank" className="flex items-center gap-2 text-sm font-medium hover:text-accent"><FileText className="h-4 w-4" /> {doc.filename}</a>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>{KINDS.find((k) => k[0] === doc.kind)?.[1]} · {(doc.size_bytes / 1024).toFixed(0)} KB · {new Date(doc.created_at).toLocaleDateString()} · {doc.review_status}</span>
          <button aria-label="Delete document" className="hover:text-bad" disabled={pending} onClick={() => { if (confirm(`Delete ${doc.filename}?`)) start(async () => { await fetch(`/api/documents/${doc.id}`, { method: "DELETE" }); router.refresh(); }); }}><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      {a && (
        <div className="mt-2 text-xs">
          {a.domains.length > 0 && <p className="text-muted">Detected domains: {a.domains.slice(0, 8).map((d) => d.label).join(", ")}</p>}
          {a.notes.map((n) => <p key={n} className="text-muted">{n}</p>)}
          {doc.review_status === "pending" && hasSuggestions ? (
            <div className="mt-2 space-y-2 rounded-lg bg-raised/50 p-2">
              <p className="font-medium text-fg">Review before adding to your profile:</p>
              {a.suggestions.skills.length > 0 && <div><p className="label">New skills</p><div className="flex flex-wrap gap-1">{a.suggestions.skills.map((s) => <label key={s} className="chip cursor-pointer border border-line bg-panel"><input type="checkbox" checked={skills.has(s)} onChange={() => toggle(skills, s, setSkills)} /> {s}</label>)}</div></div>}
              {a.suggestions.publications.length > 0 && <div><p className="label">Publications</p>{a.suggestions.publications.map((p) => <label key={p} className="flex items-start gap-1.5"><input type="checkbox" checked={pubs.has(p)} onChange={() => toggle(pubs, p, setPubs)} /> {p}</label>)}</div>}
              {a.suggestions.experience.length > 0 && <div><p className="label">Experience</p>{a.suggestions.experience.map((e, i) => <label key={i} className="flex items-start gap-1.5"><input type="checkbox" checked={exp.has(i)} onChange={() => toggle(exp, i, setExp)} /> {e.role} · {e.org}</label>)}</div>}
              {a.suggestions.summary && <label className="flex items-start gap-1.5"><input type="checkbox" checked={useSummary} onChange={(e) => setUseSummary(e.target.checked)} /> Replace summary with: <em>{a.suggestions.summary}</em></label>}
              <div className="flex gap-2">
                <button className="btn-primary py-1 text-xs" disabled={pending} onClick={() => start(async () => {
                  const r = await applyDocumentSuggestions(doc.id, { skills: [...skills], publications: [...pubs], experience: [...exp], summary: useSummary ? a.suggestions.summary : undefined });
                  setMsg(r.ok ? r.message ?? "Applied" : r.error);
                })}>Approve selected</button>
                <button className="btn-ghost py-1 text-xs" disabled={pending} onClick={() => start(async () => { await dismissDocumentSuggestions(doc.id); })}>Dismiss</button>
              </div>
              {msg && <p className="text-good">{msg}</p>}
            </div>
          ) : null}
        </div>
      )}
    </li>
  );
}

export function PreferencesForm({ prefs }: { prefs: Preferences }) {
  const [state, onSubmit, pending] = useFormAction(savePreferences);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label><span className="label">Citizenship</span>
          <select name="citizenship" defaultValue={prefs.citizenship} className="input">
            <option value="non_us_citizen">Not a U.S. citizen</option><option value="permanent_resident">U.S. permanent resident</option><option value="us_citizen">U.S. citizen</option><option value="prefer_not">Prefer not to say</option>
          </select>
        </label>
        <label><span className="label">U.S. person (export control)?</span>
          <select name="usPerson" defaultValue={prefs.usPerson} className="input"><option value="unknown">Not set</option><option value="yes">Yes</option><option value="no">No</option></select>
        </label>
        <label className="sm:col-span-2"><span className="label">Current work authorization</span><input name="workAuthorization" defaultValue={prefs.workAuthorization} maxLength={200} className="input" placeholder="e.g. F-1 student (CPT/OPT eligible), or describe your status" /></label>
        <label><span className="label">Visa sponsorship</span>
          <select name="sponsorship" defaultValue={prefs.sponsorship} className="input"><option value="unknown">Not set</option><option value="needs_now">Need sponsorship now</option><option value="needs_future">Will need it in the future</option><option value="not_needed">Won&apos;t need sponsorship</option></select>
        </label>
        <label><span className="label">Security clearance eligible</span>
          <select name="clearance" defaultValue={prefs.clearance} className="input"><option value="unknown">Not set</option><option value="yes">Yes</option><option value="no">No</option></select>
        </label>
        <label><span className="label">Degree level</span>
          <select name="degreeLevel" defaultValue={prefs.degreeLevel} className="input"><option value="bachelors">Bachelor&apos;s</option><option value="masters">Master&apos;s</option><option value="phd">Ph.D.</option></select>
        </label>
        <label><span className="label">Graduation (YYYY-MM)</span><input name="graduation" defaultValue={prefs.graduation} className="input" pattern="\d{4}-\d{2}" /></label>
        <label className="sm:col-span-2"><span className="label">Preferred locations (one per line)</span><textarea name="locations" defaultValue={prefs.locations.join("\n")} rows={2} className="input" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="openToRelocate" defaultChecked={prefs.openToRelocate} /> Open to relocate</label>
      </div>
      <fieldset><legend className="label">Employment types</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {[["internship", "Internship"], ["co_op", "Co-op"], ["full_time", "Full-time"], ["research", "Research"], ["development_program", "Development program"]].map(([v, l]) => (
            <label key={v} className="flex items-center gap-1"><input type="checkbox" name="employmentTypes" value={v} defaultChecked={prefs.employmentTypes.includes(v)} /> {l}</label>
          ))}
        </div>
      </fieldset>
      <label className="block"><span className="label">Industries, ranked (one per line; top = highest priority)</span>
        <textarea name="industries" defaultValue={prefs.industries.join("\n")} rows={6} className="input" />
        <span className="mt-1 block text-[11px] text-muted">Options: {INDUSTRY_OPTIONS.join(", ")}</span>
      </label>
      <label className="block"><span className="label">Employment goals</span><textarea name="goals" defaultValue={prefs.goals} rows={2} maxLength={2000} className="input" /></label>
      <div className="flex items-center gap-3"><button className="btn-primary" disabled={pending}>Save preferences</button>
        {state && (state.ok ? <span className="text-xs text-good">{state.message}</span> : <span className="text-xs text-bad">{state.error}</span>)}</div>
    </form>
  );
}

export function ProfileEditor({ data }: { data: ProfileData }) {
  const [basic, setBasic] = useState({ fullName: data.fullName, headline: data.headline ?? "", location: data.location ?? "", linkedinUrl: data.linkedinUrl ?? "", email: data.email ?? "", phone: data.phone ?? "", summary: data.summary ?? "" });
  const [skills, setSkills] = useState(data.skillGroups.map((g) => `${g.name}: ${g.items.join(", ")}`).join("\n"));
  const [certs, setCerts] = useState(data.certifications.join("\n"));
  const [advanced, setAdvanced] = useState(JSON.stringify({ education: data.education, experience: data.experience, research: data.research, projects: data.projects, publications: data.publications, leadership: data.leadership, affiliations: data.affiliations }, null, 2));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const save = () => start(async () => {
    let adv: Partial<ProfileData>;
    try { adv = JSON.parse(advanced); } catch { setMsg({ ok: false, text: "Experience/research JSON is invalid" }); return; }
    const skillGroups = skills.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const [name, rest] = l.includes(":") ? [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1)] : ["Skills", l];
      return { name: name.trim(), items: rest.split(",").map((s) => s.trim()).filter(Boolean) };
    });
    const payload = { ...basic, ...adv, skillGroups, certifications: certs.split("\n").map((s) => s.trim()).filter(Boolean) };
    const r = await saveProfileJson(JSON.stringify(payload));
    setMsg(r.ok ? { ok: true, text: r.message ?? "Saved" } : { ok: false, text: r.error });
  });

  const f = (k: keyof typeof basic, label: string, type = "text") => (
    <label><span className="label">{label}</span><input type={type} className="input" value={basic[k]} onChange={(e) => setBasic((b) => ({ ...b, [k]: e.target.value }))} /></label>
  );
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {f("fullName", "Full name")}
        {f("location", "Location")}
        <div className="sm:col-span-2">{f("headline", "Headline")}</div>
        {f("linkedinUrl", "LinkedIn URL", "url")}
        {f("email", "Email (optional, stays private)", "email")}
        {f("phone", "Phone (optional, stays private)")}
      </div>
      <label className="block"><span className="label">Summary</span><textarea className="input" rows={3} value={basic.summary} onChange={(e) => setBasic((b) => ({ ...b, summary: e.target.value }))} /></label>
      <label className="block"><span className="label">Skills (one group per line: &quot;Group: a, b, c&quot;)</span><textarea className="input font-mono text-xs" rows={5} value={skills} onChange={(e) => setSkills(e.target.value)} /></label>
      <label className="block"><span className="label">Certifications (one per line)</span><textarea className="input" rows={2} value={certs} onChange={(e) => setCerts(e.target.value)} /></label>
      <details className="rounded-lg border border-line p-2">
        <summary className="cursor-pointer text-sm font-medium">Education, experience, research, projects, publications, leadership (structured JSON)</summary>
        <textarea className="input mt-2 font-mono text-[11px]" rows={18} value={advanced} onChange={(e) => setAdvanced(e.target.value)} spellCheck={false} aria-label="Structured profile JSON" />
      </details>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending} onClick={save}>{pending ? "Saving…" : "Approve & save profile"}</button>
        {msg && <span className={`text-xs ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
