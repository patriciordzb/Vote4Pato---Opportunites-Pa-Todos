"use client";

import Link from "@/components/link";
import { useState, useTransition } from "react";
import { Loader2, ScanSearch, Trash2 } from "lucide-react";
import { deleteApplication, saveJobToTracker, setJobListingStatus, updateApplication } from "@/app/actions";
import { Markdown } from "@/components/forms";
import { APPLICATION_STATUSES, type Application } from "@/lib/types";

export function JobActions({ jobId, saved, listingStatus }: { jobId: string; saved: boolean; listingStatus: string }) {
  const [pending, start] = useTransition();
  const [isSaved, setSaved] = useState(saved);
  return (
    <>
      <button className="btn-ghost" disabled={isSaved || pending} onClick={() => start(async () => { const r = await saveJobToTracker(jobId); if (r.ok) setSaved(true); })}>
        {isSaved ? "In tracker" : "Save to tracker"}
      </button>
      <select aria-label="Listing status" className="input w-auto text-xs" defaultValue={listingStatus} onChange={(e) => start(async () => { await setJobListingStatus(jobId, e.target.value as "open"); })}>
        <option value="unknown">Listing: unconfirmed</option>
        <option value="open">I confirmed it&apos;s open</option>
        <option value="closed">Closed</option>
      </select>
    </>
  );
}

export function ResumeMatch({ jobId }: { jobId: string }) {
  const [pending, start] = useTransition();
  const [out, setOut] = useState<{ match: { score: number; matched: string[]; missing: string[] }; ai: string | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="w-full sm:w-auto">
      <button className="btn-ghost" disabled={pending} onClick={() => start(async () => {
        setErr(null);
        const res = await fetch("/api/ai/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: "resume_match", jobId }) });
        const j = await res.json();
        if (!res.ok) setErr(j.error ?? "Failed"); else setOut(j);
      })}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />} Resume-to-job match
      </button>
      {err && <p className="text-xs text-bad">{err}</p>}
      {out && (
        <div className="mt-2 rounded-lg border border-line bg-raised/40 p-3 text-sm sm:min-w-[420px]">
          <p className="font-medium">Rule-based match: {out.match.score}/100</p>
          <p className="text-xs text-good">Matching: {out.match.matched.join(", ") || "none detected"}</p>
          <p className="text-xs text-warn">Missing/confirm: {out.match.missing.join(", ") || "none detected"}</p>
          {out.ai ? <div className="mt-2 border-t border-line pt-2"><p className="mb-1 text-[11px] font-medium uppercase text-info">AI analysis, review before use</p><Markdown text={out.ai} /></div>
            : <p className="mt-1 text-xs text-muted">Set ANTHROPIC_API_KEY for a detailed AI comparison and resume edits.</p>}
        </div>
      )}
    </div>
  );
}

export function ApplicationRow({ app }: { app: Application }) {
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState(app.notes ?? "");
  return (
    <tr className="border-t border-line align-top">
      <td className="py-2 pr-2">{app.url ? <a href={app.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent">{app.title}</a> : app.title}</td>
      <td className="pr-2"><Link className="hover:text-accent" href={`/companies/${app.company_slug}`}>{app.company_name}</Link></td>
      <td className="pr-2">
        <select aria-label="Application status" className="input w-auto py-1 text-xs" defaultValue={app.status} onChange={(e) => start(async () => { await updateApplication(app.id, { status: e.target.value }); })}>
          {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
      </td>
      <td className="pr-2 text-xs text-muted">{app.applied_at ?? "—"}</td>
      <td className="pr-2"><input aria-label="Application notes" className="input py-1 text-xs" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (app.notes ?? "") && start(async () => { await updateApplication(app.id, { notes }); })} /></td>
      <td>
        {pending ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : (
          <button aria-label="Remove application" className="text-muted hover:text-bad" onClick={() => { if (confirm("Remove this application from your tracker?")) start(async () => { await deleteApplication(app.id); }); }}><Trash2 className="h-4 w-4" /></button>
        )}
      </td>
    </tr>
  );
}
