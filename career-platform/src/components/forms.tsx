"use client";

import { useFormAction } from "@/components/use-form-action";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck, Footprints, Loader2, Sparkles, Trash2 } from "lucide-react";
import { addInteraction, addJob, addNote, addRecruiter, deleteNote, updateCompanyTracking, updateRecruiterContact, type ActionResult } from "@/app/actions";
import { CRM_LABEL, CRM_STATUSES, type CrmStatus } from "@/lib/types";

function Feedback({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return state.ok
    ? <p className="text-xs text-good" role="status">{state.message ?? "Saved"}</p>
    : <p className="text-xs text-bad" role="alert">{state.error}</p>;
}

function useResetOnSuccess(state: ActionResult | null) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return ref;
}

export function TrackingControls({ companyId, status, saved, visited, visitOrder }: { companyId: string; status: CrmStatus; saved: boolean; visited: boolean; visitOrder: number | null }) {
  const [s, setS] = useState({ status, saved, visited, visitOrder });
  const [pending, start] = useTransition();
  const run = (patch: Parameters<typeof updateCompanyTracking>[1], local: Partial<typeof s>) => {
    setS((x) => ({ ...x, ...local }));
    start(async () => { await updateCompanyTracking(companyId, patch); });
  };
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label>
        <span className="label">Networking status</span>
        <select className="input" value={s.status} onChange={(e) => run({ status: e.target.value as CrmStatus }, { status: e.target.value as CrmStatus })}>
          {CRM_STATUSES.map((v) => <option key={v} value={v}>{CRM_LABEL[v]}</option>)}
        </select>
      </label>
      <label className="w-24">
        <span className="label">Visit #</span>
        <input type="number" min={1} max={999} className="input" defaultValue={s.visitOrder ?? ""} placeholder="—"
          onBlur={(e) => { const v = e.target.value ? Number(e.target.value) : null; if (v !== s.visitOrder) run({ visit_order: v }, { visitOrder: v }); }} />
      </label>
      <button className="btn-ghost" onClick={() => run({ saved: !s.saved }, { saved: !s.saved })} aria-pressed={s.saved}>
        {s.saved ? <BookmarkCheck className="h-4 w-4 text-accent" /> : <Bookmark className="h-4 w-4" />} {s.saved ? "Saved" : "Save"}
      </button>
      <button className={s.visited ? "btn border border-good/40 bg-good/10 text-good" : "btn-ghost"} onClick={() => run({ visited: !s.visited }, { visited: !s.visited, status: !s.visited && ["none", "want_to_meet", "high_priority"].includes(s.status) ? "visited_booth" : s.status })} aria-pressed={s.visited}>
        <Footprints className="h-4 w-4" /> {s.visited ? "Booth visited" : "Mark visited"}
      </button>
      {pending && <Loader2 className="h-4 w-4 animate-spin text-muted" aria-label="Saving" />}
    </div>
  );
}

export function InteractionForm({ companyId, recruiters, compact = false }: { companyId: string; recruiters: { id: string; full_name: string }[]; compact?: boolean }) {
  const [state, onSubmit, pending] = useFormAction(addInteraction);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="company_id" value={companyId} />
      <div className="grid gap-2 sm:grid-cols-3">
        <label><span className="label">Type</span>
          <select name="kind" className="input" defaultValue="conversation">
            <option value="booth_visit">Booth visit</option><option value="conversation">Conversation</option><option value="linkedin">LinkedIn</option>
            <option value="email">Email</option><option value="interview">Interview</option><option value="info_session">Info session</option><option value="other">Other</option>
          </select>
        </label>
        <label><span className="label">With</span>
          <select name="recruiter_id" className="input" defaultValue=""><option value="">— not recorded —</option>{recruiters.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}</select>
        </label>
        <label><span className="label">When</span><input type="datetime-local" name="occurred_at" className="input" /></label>
      </div>
      <label className="block"><span className="label">What did you talk about?</span>
        <textarea name="summary" required rows={compact ? 2 : 3} maxLength={5000} className="input" placeholder="e.g. Spoke with a manufacturing engineer about LPBF process qualification and Summer 2027 internships" />
      </label>
      {!compact && (
        <div className="grid gap-2 sm:grid-cols-2">
          <label><span className="label">Opportunities discussed</span><input name="opportunities_discussed" maxLength={2000} className="input" /></label>
          <label><span className="label">Personal impressions</span><input name="impressions" maxLength={2000} className="input" /></label>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="sm:col-span-2"><span className="label">Follow-up action (creates a task)</span><input name="follow_up" maxLength={300} className="input" placeholder="e.g. Apply online and message on LinkedIn" /></label>
        <label><span className="label">Due</span><input type="date" name="follow_up_due" className="input" /></label>
      </div>
      <label className="block"><span className="label">Update status to</span>
        <select name="new_status" className="input" defaultValue=""><option value="">Automatic (based on type)</option>{CRM_STATUSES.filter((s) => s !== "none").map((s) => <option key={s} value={s}>{CRM_LABEL[s]}</option>)}</select>
      </label>
      <div className="flex items-center gap-3"><button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Log interaction"}</button><Feedback state={state} /></div>
    </form>
  );
}

export function NoteForm({ entityType, entityId }: { entityType: "company" | "recruiter" | "job" | "general"; entityId?: string }) {
  const [state, onSubmit, pending] = useFormAction(addNote);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="entity_type" value={entityType} />
      {entityId && <input type="hidden" name="entity_id" value={entityId} />}
      <textarea name="body" required rows={2} maxLength={10000} className="input" placeholder="Add a private note…" />
      <div className="flex items-center gap-3"><button className="btn-ghost" disabled={pending}>Add note</button><Feedback state={state} /></div>
    </form>
  );
}

export function NoteItem({ id, body, createdAt }: { id: string; body: string; createdAt: string }) {
  const [pending, start] = useTransition();
  return (
    <li className="flex gap-2 py-2 text-sm">
      <div className="flex-1 whitespace-pre-wrap">{body}<p className="text-xs text-muted">{new Date(createdAt).toLocaleString()}</p></div>
      <button disabled={pending} className="text-muted hover:text-bad" aria-label="Delete note" onClick={() => start(async () => { await deleteNote(id); })}><Trash2 className="h-4 w-4" /></button>
    </li>
  );
}

export function RecruiterForm({ companies, companyId }: { companies?: { id: string; name: string }[]; companyId?: string }) {
  const [state, onSubmit, pending] = useFormAction(addRecruiter);
  const ref = useResetOnSuccess(state);
  const [status, setStatus] = useState("potential");
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-2">
      {companyId ? <input type="hidden" name="company_id" value={companyId} /> : (
        <label className="block"><span className="label">Company</span>
          <select name="company_id" required className="input" defaultValue="">{[<option key="" value="" disabled>Select…</option>, ...(companies ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)]}</select>
        </label>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <label><span className="label">Full name *</span><input name="full_name" required minLength={2} maxLength={120} className="input" /></label>
        <label><span className="label">Title</span><input name="title" maxLength={200} className="input" placeholder="e.g. University Recruiter" /></label>
        <label><span className="label">LinkedIn URL</span><input name="linkedin_url" type="url" className="input" placeholder="https://www.linkedin.com/in/…" /></label>
        <label><span className="label">Recruiting / engineering focus</span><input name="specialization" maxLength={300} className="input" placeholder="e.g. Manufacturing & materials early careers" /></label>
      </div>
      <label className="block"><span className="label">Public professional background (optional)</span><textarea name="background" rows={2} maxLength={2000} className="input" placeholder="Only work-relevant public info" /></label>
      <fieldset className="rounded-lg border border-line p-3">
        <legend className="px-1 text-xs font-medium text-muted">SHPE 2026 attendance</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {[["confirmed", "Confirmed attending (needs evidence)"], ["potential", "Potential contact"], ["unverified", "Unverified"]].map(([v, l]) => (
            <label key={v} className="flex items-center gap-1.5"><input type="radio" name="attendance_status" value={v} checked={status === v} onChange={() => setStatus(v)} /> {l}</label>
          ))}
        </div>
        {status === "confirmed" && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label><span className="label">Evidence URL *</span><input name="evidence_url" type="url" className="input" placeholder="e.g. their public post naming SHPE 2026" /></label>
            <label><span className="label">What it says *</span><input name="evidence_text" maxLength={1000} className="input" /></label>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">A company exhibiting doesn't make its recruiters &quot;confirmed&quot;. Use Confirmed only with public evidence naming this person at SHPE 2026.</p>
      </fieldset>
      <div className="flex items-center gap-3"><button className="btn-primary" disabled={pending}>Save recruiter</button><Feedback state={state} /></div>
    </form>
  );
}

export function RecruiterContactControls({ recruiterId, status, saved, notes, mutual }: { recruiterId: string; status: CrmStatus; saved: boolean; notes: string; mutual: string }) {
  const [s, setS] = useState({ status, saved });
  const [pending, start] = useTransition();
  const [n, setN] = useState(notes);
  const [m, setM] = useState(mutual);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Networking status" className="input w-auto" value={s.status} onChange={(e) => { const v = e.target.value as CrmStatus; setS((x) => ({ ...x, status: v })); start(async () => { await updateRecruiterContact(recruiterId, { status: v }); }); }}>
          {CRM_STATUSES.map((v) => <option key={v} value={v}>{CRM_LABEL[v]}</option>)}
        </select>
        <button className="btn-ghost" aria-pressed={s.saved} onClick={() => { setS((x) => ({ ...x, saved: !x.saved })); start(async () => { await updateRecruiterContact(recruiterId, { saved: !s.saved }); }); }}>
          {s.saved ? <BookmarkCheck className="h-4 w-4 text-accent" /> : <Bookmark className="h-4 w-4" />} {s.saved ? "Saved" : "Save"}
        </button>
        {pending && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
      </div>
      <textarea aria-label="Notes" className="input" rows={2} value={n} onChange={(e) => setN(e.target.value)} onBlur={() => n !== notes && start(async () => { await updateRecruiterContact(recruiterId, { notes: n }); })} placeholder="Notes (saved when you leave the field)" />
      <input aria-label="Mutual connections" className="input" value={m} onChange={(e) => setM(e.target.value)} onBlur={() => m !== mutual && start(async () => { await updateRecruiterContact(recruiterId, { mutual_connections: m }); })} placeholder="Mutual connections (entered by you)" />
    </div>
  );
}

export function JobForm({ companies, companyId }: { companies: { id: string; name: string }[]; companyId?: string }) {
  const [state, onSubmit, pending] = useFormAction(addJob);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <label><span className="label">Company *</span>
          <select name="company_id" required className="input" defaultValue={companyId ?? ""}>{[<option key="" value="" disabled>Select…</option>, ...companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)]}</select>
        </label>
        <label><span className="label">Position title *</span><input name="title" required minLength={2} maxLength={200} className="input" /></label>
        <label><span className="label">Requisition ID</span><input name="requisition_id" maxLength={60} className="input" /></label>
        <label><span className="label">Location</span><input name="location" maxLength={200} className="input" /></label>
        <label><span className="label">Employment type</span>
          <select name="employment_type" className="input" defaultValue="internship">
            <option value="internship">Internship</option><option value="co_op">Co-op</option><option value="full_time">Full-time</option><option value="research">Research</option><option value="development_program">Development program</option><option value="part_time">Part-time</option><option value="other">Other</option>
          </select>
        </label>
        <label><span className="label">Application link (official posting)</span><input name="apply_url" type="url" className="input" placeholder="https://…" /></label>
        <label><span className="label">Deadline</span><input name="deadline" type="date" className="input" /></label>
        <label><span className="label">Salary (if posted)</span><input name="salary" maxLength={120} className="input" /></label>
      </div>
      <label className="block"><span className="label">Description</span><textarea name="description" rows={3} maxLength={8000} className="input" placeholder="Paste the job description. Matching uses it." /></label>
      <label className="block"><span className="label">Required qualifications (one per line)</span><textarea name="qualifications" rows={3} maxLength={4000} className="input" /></label>
      <fieldset className="rounded-lg border border-line p-3">
        <legend className="px-1 text-xs font-medium text-muted">Work-authorization requirements, exactly as the posting states</legend>
        <div className="grid gap-2 sm:grid-cols-4">
          {[["citizenship_required", "U.S. citizenship required"], ["us_person_required", "U.S. person required"], ["clearance_required", "Clearance required"]].map(([n, l]) => (
            <label key={n}><span className="label">{l}</span><select name={n} className="input" defaultValue="unknown"><option value="unknown">Not stated</option><option value="yes">Yes</option><option value="no">No</option></select></label>
          ))}
          <label><span className="label">Sponsorship</span><select name="sponsorship" className="input" defaultValue="unknown"><option value="unknown">Not stated</option><option value="offered">Offered</option><option value="not_offered">Not offered</option></select></label>
        </div>
        <input name="eligibility_note" maxLength={1000} className="input mt-2" placeholder="Quote the posting's eligibility sentence (optional)" />
      </fieldset>
      <div className="flex items-center gap-3"><button className="btn-primary" disabled={pending}>Save job</button><Feedback state={state} /></div>
    </form>
  );
}

/** Calls /api/ai/generate and renders markdown-ish text. */
export function AiGenerate({ payload, label = "Refine with AI", aiEnabled }: { payload: Record<string, unknown>; label?: string; aiEnabled: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!aiEnabled) return <p className="text-xs text-muted">AI refinement is available once <code>ANTHROPIC_API_KEY</code> is set on the server.</p>;
  return (
    <div className="space-y-2">
      <button className="btn-ghost" disabled={pending} onClick={() => start(async () => {
        setErr(null);
        const res = await fetch("/api/ai/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const j = await res.json().catch(() => ({}));
        if (res.status === 401) return router.push("/login");
        if (!res.ok) setErr(j.error ?? "Failed");
        else setText(j.text ?? j.ai ?? "");
      })}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {label}
      </button>
      {err && <p className="text-xs text-bad">{err}</p>}
      {text && <div className="rounded-lg border border-info/30 bg-info/5 p-3"><p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-info">AI-generated, review before use</p><Markdown text={text} /></div>}
    </div>
  );
}

/** Tiny safe markdown renderer (headings, bold, lists, tables, paragraphs). No HTML injection. */
export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  let table: string[][] = [];
  const flush = () => {
    if (list.length) { out.push(<ul key={out.length} className="mb-2 list-disc space-y-1 pl-5">{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; }
    if (table.length) {
      const rows = table.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c.trim())));
      out.push(<div key={out.length} className="mb-2 overflow-x-auto"><table className="w-full text-left text-xs"><tbody>{rows.map((r, i) => <tr key={i} className="border-b border-line">{r.map((c, j) => i === 0 ? <th key={j} className="px-2 py-1">{inline(c)}</th> : <td key={j} className="px-2 py-1 align-top">{inline(c)}</td>)}</tr>)}</tbody></table></div>);
      table = [];
    }
  };
  for (const raw of lines) {
    const l = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(l)) { if (table.length) flush(); list.push(l.replace(/^\s*[-*]\s+/, "")); continue; }
    if (/^\s*\d+\.\s+/.test(l)) { if (table.length) flush(); list.push(l.replace(/^\s*\d+\.\s+/, "")); continue; }
    if (/^\|.*\|$/.test(l.trim())) { if (list.length) flush(); table.push(l.trim().slice(1, -1).split("|")); continue; }
    flush();
    if (!l.trim()) continue;
    const h = l.match(/^(#{1,4})\s+(.*)/);
    if (h) out.push(<p key={out.length} className="mb-1 mt-2 font-semibold">{inline(h[2])}</p>);
    else out.push(<p key={out.length} className="mb-2 leading-relaxed">{inline(l)}</p>);
  }
  flush();
  return <div className="text-sm">{out}</div>;
}

function inline(s: string): React.ReactNode[] {
  const parts = s.split(/(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|\[(?:Sourced|AI advice)[^\]]*\])/g);
  return parts.map((p, i) => {
    if (/^\*\*.*\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (/^_.*_$/.test(p) && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
    if (/^`.*`$/.test(p)) return <code key={i} className="rounded bg-raised px-1">{p.slice(1, -1)}</code>;
    if (/^\[Sourced/.test(p)) return <span key={i} className="chip mx-0.5 bg-good/15 text-good">{p.slice(1, -1)}</span>;
    if (/^\[AI advice/.test(p)) return <span key={i} className="chip mx-0.5 bg-info/15 text-info">{p.slice(1, -1)}</span>;
    return p;
  });
}
