"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Linkedin, Loader2, Save, Sparkles, Trash2, Wand2 } from "lucide-react";
import { CopyButton } from "@/components/client";
import { deleteDraft, saveDraft } from "@/app/actions";
import { linkedinPeopleSearch } from "@/lib/coach";

interface Props {
  companies: { id: string; slug: string; name: string }[];
  recruiters: { id: string; name: string; company_id: string; linkedin_url: string | null }[];
  jobs: { id: string; title: string; company_id: string }[];
  kinds: { value: string; label: string }[];
  initial: { company: string; recruiter: string; kind: string; notes: string };
  ai: boolean;
}

export function MessageStudio({ companies, recruiters, jobs, kinds, initial, ai }: Props) {
  const [company, setCompany] = useState(initial.company);
  const [recruiter, setRecruiter] = useState(initial.recruiter);
  const [job, setJob] = useState("");
  const [kind, setKind] = useState(kinds.some((k) => k.value === initial.kind) ? initial.kind : "connection");
  const [notes, setNotes] = useState(initial.notes);
  const [text, setText] = useState("");
  const [source, setSource] = useState<"template" | "ai" | "user">("template");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const c = companies.find((x) => x.slug === company);
  const r = recruiters.find((x) => x.id === recruiter);

  const generate = useCallback((mode: "template" | "ai") => {
    if (!c) return;
    start(async () => {
      setMsg(null);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "message", kind, companySlug: c.slug, recruiterId: recruiter || null, jobId: job || null, notes, mode }),
      });
      const j = await res.json();
      if (!res.ok) { setMsg(j.error ?? "Failed"); return; }
      setText(j.text);
      setSource(j.source === "ai" ? "ai" : "template");
      if (j.notice) setMsg(j.notice);
    });
  }, [c, kind, recruiter, job, notes]);

  useEffect(() => { generate("template"); }, [company, recruiter, job, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const limit = kind === "connection" ? 300 : null;
  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="card space-y-3 p-4 lg:col-span-2">
        <label className="block"><span className="label">Message type</span>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>{kinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
        </label>
        <label className="block"><span className="label">Company</span>
          <select className="input" value={company} onChange={(e) => { setCompany(e.target.value); setRecruiter(""); setJob(""); }}>{companies.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}</select>
        </label>
        <label className="block"><span className="label">Recruiter (optional)</span>
          <select className="input" value={recruiter} onChange={(e) => setRecruiter(e.target.value)}>
            <option value="">— none / unknown name —</option>
            {recruiters.filter((x) => x.company_id === c?.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <label className="block"><span className="label">Job (optional)</span>
          <select className="input" value={job} onChange={(e) => setJob(e.target.value)}>
            <option value="">— none —</option>
            {jobs.filter((x) => x.company_id === c?.id).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select>
        </label>
        <label className="block"><span className="label">Conversation notes (personalizes follow-ups)</span>
          <textarea className="input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. LPBF process qualification and Summer 2027 internships" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={() => generate("template")} disabled={pending}><Wand2 className="h-4 w-4" /> Regenerate</button>
          <button className="btn-primary" onClick={() => generate("ai")} disabled={pending || !ai} title={ai ? "" : "Set ANTHROPIC_API_KEY to enable"}><Sparkles className="h-4 w-4" /> Personalize with AI</button>
        </div>
        {!ai && <p className="text-xs text-muted">AI personalization needs <code>ANTHROPIC_API_KEY</code>. Template drafts use only your profile and notes.</p>}
      </div>

      <div className="card space-y-3 p-4 lg:col-span-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Draft {source === "ai" ? <span className="chip ml-1 bg-info/15 text-info">AI-written: review it</span> : source === "template" ? <span className="chip ml-1 bg-raised text-muted">Template</span> : <span className="chip ml-1 bg-raised text-muted">Edited</span>}</p>
          {pending && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
        </div>
        <textarea className="input font-[inherit] leading-relaxed" rows={12} value={text} onChange={(e) => { setText(e.target.value); setSource("user"); }} aria-label="Message draft" />
        {limit && <p className={`text-xs ${text.length > limit ? "text-bad" : "text-muted"}`}>{text.length}/{limit} characters (LinkedIn connection-note limit)</p>}
        {msg && <p className="text-xs text-warn">{msg}</p>}
        <div className="flex flex-wrap gap-2">
          <CopyButton text={text} className="btn-primary" />
          <a className="btn-ghost" href={r?.linkedin_url ?? linkedinPeopleSearch(c?.name ?? "")} target="_blank" rel="noopener noreferrer"><Linkedin className="h-4 w-4" /> {r?.linkedin_url ? "Open recruiter's LinkedIn" : "Find on LinkedIn"}</a>
          <button className="btn-ghost" disabled={!text || pending} onClick={() => start(async () => {
            const res = await saveDraft({ company_id: c?.id ?? null, recruiter_id: recruiter || null, job_id: job || null, kind, body: text, generated_by: source });
            setMsg(res.ok ? "Draft saved" : res.error);
          })}><Save className="h-4 w-4" /> Save draft</button>
        </div>
        <p className="text-xs text-muted">Sending happens only when you paste and send it on LinkedIn. This app has no permission to message or connect on your behalf.</p>
      </div>
    </div>
  );
}

export function DraftList({ drafts }: { drafts: { id: string; kind: string; body: string; generated_by: string; created_at: string; company_name: string | null; recruiter_name: string | null }[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [, start] = useTransition();
  const rows = drafts.filter((d) => !hidden.has(d.id));
  if (!rows.length) return <p className="text-sm text-muted">No saved drafts.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((d) => (
        <li key={d.id} className="rounded-lg border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>{d.kind.replace(/_/g, " ")} · {d.company_name ?? "—"}{d.recruiter_name ? ` · ${d.recruiter_name}` : ""} · {d.generated_by} · {new Date(d.created_at).toLocaleString()}</span>
            <span className="flex gap-2">
              <CopyButton text={d.body} className="text-accent inline-flex items-center gap-1" />
              <button aria-label="Delete draft" className="hover:text-bad" onClick={() => { setHidden((h) => new Set(h).add(d.id)); start(async () => { await deleteDraft(d.id); }); }}><Trash2 className="h-4 w-4" /></button>
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{d.body}</p>
        </li>
      ))}
    </ul>
  );
}
