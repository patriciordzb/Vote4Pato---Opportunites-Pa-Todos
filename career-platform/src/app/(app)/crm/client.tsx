"use client";

import { useFormAction } from "@/components/use-form-action";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { addInteraction, deleteInteraction, updateCompanyTracking, updateRecruiterContact } from "@/app/actions";
import { CRM_LABEL, CRM_STATUSES, type CrmStatus, type Interaction } from "@/lib/types";

export interface BoardItem {
  id: string; kind: "company" | "recruiter"; name: string; sub: string; href: string; status: CrmStatus;
  score: number; notes: string; saved: boolean; visited: boolean; interactions: number;
}

const COLUMNS = CRM_STATUSES.filter((s) => s !== "none");

export function CrmBoard({ items }: { items: BoardItem[] }) {
  const [local, setLocal] = useState<Record<string, CrmStatus>>({});
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [, start] = useTransition();
  const rows = useMemo(() => items.map((i) => ({ ...i, status: local[i.id] ?? i.status })).filter((i) =>
    (!q || `${i.name} ${i.sub} ${i.notes}`.toLowerCase().includes(q.toLowerCase())) && (!kind || i.kind === kind)), [items, local, q, kind]);
  const tracked = rows.filter((r) => r.status !== "none");
  const untracked = rows.filter((r) => r.status === "none").sort((a, b) => b.score - a.score);

  const move = (i: BoardItem, s: CrmStatus) => {
    setLocal((l) => ({ ...l, [i.id]: s }));
    start(async () => {
      if (i.kind === "company") await updateCompanyTracking(i.id, { status: s });
      else await updateRecruiterContact(i.id, { status: s });
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className="input" placeholder="Search pipeline (name, notes)…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search pipeline" />
        <select className="input sm:w-48" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter type"><option value="">Companies & people</option><option value="company">Companies</option><option value="recruiter">Recruiters</option></select>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {COLUMNS.map((col) => {
          const colItems = tracked.filter((r) => r.status === col);
          return (
            <section key={col} className="w-64 shrink-0 rounded-lg border border-line bg-raised/30 p-2" aria-label={CRM_LABEL[col]}>
              <h3 className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-muted">{CRM_LABEL[col]}<span className="rounded bg-raised px-1.5">{colItems.length}</span></h3>
              <ul className="space-y-2">
                {colItems.map((i) => (
                  <li key={i.id} className="rounded-md border border-line bg-panel p-2">
                    <Link href={i.href} className="block text-sm font-medium hover:text-accent">{i.name}</Link>
                    <p className="truncate text-[11px] text-muted">{i.kind === "recruiter" ? "👤 " : ""}{i.sub} · {i.score}/100{i.interactions ? ` · ${i.interactions} log` : ""}</p>
                    {i.notes && <p className="mt-1 line-clamp-2 text-[11px]">{i.notes}</p>}
                    <select aria-label={`Status for ${i.name}`} className="input mt-1.5 py-1 text-xs" value={i.status} onChange={(e) => move(i, e.target.value as CrmStatus)}>
                      {CRM_STATUSES.map((s) => <option key={s} value={s}>{CRM_LABEL[s]}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <details className="rounded-lg border border-line p-3">
        <summary className="cursor-pointer text-sm font-medium">Not yet tracked ({untracked.length}): add to pipeline</summary>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {untracked.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-raised">
              <span className="truncate text-sm">{i.name} <span className="text-xs text-muted">{i.score}</span></span>
              <span className="flex gap-1">
                <button className="text-xs text-accent hover:underline" onClick={() => move(i, "want_to_meet")}>Want to meet</button>
                <button className="text-xs text-good hover:underline" onClick={() => move(i, "high_priority")}>High priority</button>
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function QuickLog({ companies, recruiters }: { companies: { id: string; name: string }[]; recruiters: { id: string; name: string; company_id: string }[] }) {
  const [state, onSubmit, pending] = useFormAction(addInteraction);
  const [company, setCompany] = useState("");
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) { ref.current?.reset(); setCompany(""); } }, [state]);
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-2 md:grid-cols-6">
      <select name="company_id" required className="input md:col-span-2" value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Company">
        <option value="" disabled>Company…</option>
        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select name="recruiter_id" className="input" aria-label="Person" defaultValue="">
        <option value="">Person (optional)</option>
        {recruiters.filter((r) => r.company_id === company).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <select name="kind" className="input" defaultValue="conversation" aria-label="Type">
        <option value="booth_visit">Booth visit</option><option value="conversation">Conversation</option><option value="linkedin">LinkedIn</option><option value="email">Email</option><option value="interview">Interview</option>
      </select>
      <input name="follow_up" className="input md:col-span-2" placeholder="Follow-up task (optional)" aria-label="Follow-up task" />
      <textarea name="summary" required className="input md:col-span-5" rows={2} placeholder="What did you discuss? e.g. LPBF qualification and Summer 2027 internships" aria-label="Summary" />
      <div className="flex flex-col gap-1">
        <button className="btn-primary h-full" disabled={pending}>{pending ? "Saving…" : "Log"}</button>
        {state && (state.ok ? <span className="text-xs text-good">Saved</span> : <span className="text-xs text-bad">{state.error}</span>)}
      </div>
    </form>
  );
}

export function InteractionLog({ interactions }: { interactions: Interaction[] }) {
  const [q, setQ] = useState("");
  const [, start] = useTransition();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const rows = interactions.filter((i) => !hidden.has(i.id) && (!q || `${i.company_name} ${i.recruiter_name} ${i.summary} ${i.opportunities_discussed}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div>
      <input className="input mb-2" placeholder="Search notes…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search interactions" />
      {rows.length === 0 ? <p className="text-sm text-muted">No interactions logged yet.</p> : (
        <ul className="max-h-[480px] space-y-2 overflow-y-auto">
          {rows.map((i) => (
            <li key={i.id} className="rounded-lg border border-line p-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-muted">{new Date(i.occurred_at).toLocaleString()} · {i.kind.replace("_", " ")} · <Link className="hover:text-accent" href={`/companies/${i.company_slug}`}>{i.company_name}</Link>{i.recruiter_name ? ` · ${i.recruiter_name}` : ""}</p>
                <button aria-label="Delete interaction" className="text-muted hover:text-bad" onClick={() => { if (confirm("Delete this interaction?")) { setHidden((h) => new Set(h).add(i.id)); start(async () => { await deleteInteraction(i.id); }); } }}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <p>{i.summary}</p>
              {i.opportunities_discussed && <p className="text-xs">Opportunities: {i.opportunities_discussed}</p>}
              {i.impressions && <p className="text-xs text-muted">Impressions: {i.impressions}</p>}
              <Link href={`/messages?company=${i.company_slug}&kind=post_convention&interaction=${i.id}`} className="text-xs text-accent hover:underline">Draft follow-up from this note →</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
