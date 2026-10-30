"use client";

import Link from "@/components/link";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, Bell, BookmarkCheck, Check, ChevronDown, Copy, Footprints, Search, Send, Star, UserCheck } from "lucide-react";
import { addInteraction, toggleTask, updateCompanyTracking } from "@/app/actions";
import type { CrmStatus, Task } from "@/lib/types";

export interface FairCompany {
  id: string; slug: string; name: string; industry: string; booth: string | null; verification: string | null; score: number; tier: number;
  summary: string; pitch15: string; pitch30: string; question: string; ask: string; status: CrmStatus; saved: boolean; visited: boolean;
  recruiters: { id: string; name: string; title: string | null; attendance: string }[];
}

type View = "priority" | "saved" | "all" | "reminders";

export function FairApp({ companies, tasks, phaseLabel }: { companies: FairCompany[]; tasks: Task[]; phaseLabel: string }) {
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("priority");
  const [open, setOpen] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, Partial<FairCompany>>>({});
  const [doneTasks, setDoneTasks] = useState<Set<string>>(new Set());
  const [, start] = useTransition();

  const rows = useMemo(() => {
    const merged = companies.map((c) => ({ ...c, ...local[c.id] }));
    const needle = q.trim().toLowerCase();
    if (needle) return merged.filter((c) => c.name.toLowerCase().includes(needle) || (c.booth ?? "").includes(needle) || c.industry.toLowerCase().includes(needle));
    if (view === "saved") return merged.filter((c) => c.saved);
    if (view === "priority") return merged.filter((c) => c.tier <= 2 && c.verification && c.verification !== "unverified");
    return merged;
  }, [companies, local, q, view]);

  const patch = (c: FairCompany, p: Partial<FairCompany>, server: Parameters<typeof updateCompanyTracking>[1]) => {
    setLocal((l) => ({ ...l, [c.id]: { ...l[c.id], ...p } }));
    start(async () => { await updateCompanyTracking(c.id, server); });
  };

  return (
    <div className="mx-auto min-h-screen max-w-xl pb-24">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 px-3 pb-3 pt-3 backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1 text-sm text-muted"><ArrowLeft className="h-4 w-4" /> Full app</Link>
          <span className="chip bg-good/15 text-good">{phaseLabel}</span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} inputMode="search" placeholder="Company or booth #" aria-label="Search company or booth"
            className="w-full rounded-xl border border-line bg-raised py-3.5 pl-11 pr-3 text-lg focus:border-accent focus:outline-none" />
        </div>
      </header>

      {view === "reminders" && !q ? (
        <section className="space-y-2 p-3">
          <h2 className="text-sm font-semibold text-muted">Follow-up reminders</h2>
          {tasks.filter((t) => !doneTasks.has(t.id)).map((t) => (
            <button key={t.id} className="flex w-full items-center gap-3 rounded-xl border border-line bg-panel p-4 text-left" onClick={() => { setDoneTasks((s) => new Set(s).add(t.id)); start(async () => { await toggleTask(t.id, true); }); }}>
              <span className="grid h-7 w-7 place-items-center rounded-full border border-line"><Check className="h-4 w-4 text-muted" /></span>
              <span><span className="block">{t.title}</span><span className="text-xs text-muted">{t.company_name ?? ""}{t.due_at ? ` · due ${t.due_at}` : ""}</span></span>
            </button>
          ))}
          {tasks.every((t) => doneTasks.has(t.id)) && <p className="p-6 text-center text-muted">All caught up.</p>}
        </section>
      ) : (
        <ul className="space-y-2 p-3">
          {rows.map((c) => (
            <li key={c.id} className={`rounded-xl border bg-panel ${c.visited ? "border-good/40" : "border-line"}`}>
              <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id}>
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-accent/15 text-center text-xs font-bold leading-tight text-accent">
                  {c.booth ? <>#<br />{c.booth}</> : "—"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold">{c.name} {c.visited && <Check className="inline h-4 w-4 text-good" />}</p>
                  <p className="truncate text-xs text-muted">{c.score}/100 · {c.verification ? c.verification.replace("_", " ") : "2026 unconfirmed"}{!c.booth ? " · booth: check SHPE app" : ""}</p>
                </div>
                <ChevronDown className={`h-5 w-5 text-muted transition ${open === c.id ? "rotate-180" : ""}`} />
              </button>
              {open === c.id && <Detail c={c} onPatch={patch} />}
            </li>
          ))}
          {rows.length === 0 && <li className="p-8 text-center text-muted">{view === "saved" ? "No saved companies yet. Tap ★ on a company." : "No matches."}</li>}
        </ul>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-panel/95 backdrop-blur" aria-label="Fair mode">
        <div className="mx-auto grid max-w-xl grid-cols-4">
          {([["priority", "Priority", Star], ["saved", "Saved", BookmarkCheck], ["all", "All", Search], ["reminders", `Follow-ups${tasks.length ? ` (${tasks.length - doneTasks.size})` : ""}`, Bell]] as const).map(([v, l, Icon]) => (
            <button key={v} onClick={() => { setView(v); setQ(""); }} className={`flex flex-col items-center gap-0.5 py-3 text-xs ${view === v ? "text-accent" : "text-muted"}`} aria-pressed={view === v}>
              <Icon className="h-5 w-5" /> {l}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Detail({ c, onPatch }: { c: FairCompany; onPatch: (c: FairCompany, p: Partial<FairCompany>, s: Parameters<typeof updateCompanyTracking>[1]) => void }) {
  const [pitch, setPitch] = useState<"15" | "30">("15");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const text = pitch === "15" ? c.pitch15 : c.pitch30;
  return (
    <div className="space-y-3 border-t border-line p-4">
      <p className="text-sm text-muted">{c.summary}</p>
      <div className="rounded-lg bg-raised/60 p-3">
        <div className="mb-2 flex gap-1">
          {(["15", "30"] as const).map((p) => <button key={p} onClick={() => setPitch(p)} className={`chip ${pitch === p ? "bg-accent text-accent-fg" : "bg-panel text-muted"}`}>{p}s pitch</button>)}
          <button className="chip ml-auto bg-panel text-accent" onClick={() => navigator.clipboard?.writeText(text)}><Copy className="h-3 w-3" /> Copy</button>
        </div>
        <p className="text-[15px] leading-relaxed">{text}</p>
      </div>
      <p className="text-sm"><span className="font-semibold">Ask:</span> {c.question}</p>
      {c.recruiters.length > 0 && <p className="text-sm"><span className="font-semibold">People:</span> {c.recruiters.map((r) => `${r.name}${r.title ? ` (${r.title})` : ""}`).join(", ")}</p>}

      <div className="grid grid-cols-3 gap-2">
        <Quick active={c.visited} onClick={() => onPatch(c, { visited: !c.visited }, { visited: !c.visited })} Icon={Footprints} label={c.visited ? "Visited" : "Visited?"} />
        <Quick active={c.status === "met_recruiter"} onClick={() => onPatch(c, { status: "met_recruiter", visited: true }, { status: "met_recruiter", visited: true })} Icon={UserCheck} label="Met recruiter" />
        <Quick active={c.status === "follow_up_needed"} onClick={() => onPatch(c, { status: "follow_up_needed" }, { status: "follow_up_needed" })} Icon={Send} label="Follow up" />
        <Quick active={c.saved} onClick={() => onPatch(c, { saved: !c.saved }, { saved: !c.saved })} Icon={Star} label={c.saved ? "Saved" : "Save"} />
        <Quick active={c.status === "high_priority"} onClick={() => onPatch(c, { status: "high_priority" }, { status: "high_priority" })} Icon={Bell} label="Priority" />
        <Link href={`/companies/${c.slug}`} className="flex flex-col items-center justify-center gap-1 rounded-xl border border-line bg-raised py-3 text-xs">Full profile</Link>
      </div>

      <form className="space-y-2" onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.set("company_id", c.id); fd.set("kind", "conversation"); fd.set("summary", note);
        fd.set("follow_up", `Follow up with ${c.name}`);
        fd.set("follow_up_due", new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
        start(async () => {
          const r = await addInteraction(null, fd);
          setSaved(r.ok ? "Saved, and a follow-up reminder was added for 2 days from now." : r.error);
          if (r.ok) setNote("");
        });
      }}>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} required placeholder="Quick note: who, what you discussed, next step" className="w-full rounded-xl border border-line bg-raised p-3 text-base focus:border-accent focus:outline-none" aria-label="Quick note" />
        <button className="btn-primary w-full py-3 text-base" disabled={pending || !note.trim()}>Save note + reminder</button>
        {saved && <p className="text-center text-xs text-good">{saved}</p>}
      </form>
    </div>
  );
}

function Quick({ active, onClick, Icon, label }: { active: boolean; onClick: () => void; Icon: typeof Star; label: string }) {
  return (
    <button onClick={onClick} aria-pressed={active} className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-3 text-xs transition ${active ? "border-accent bg-accent/15 text-accent" : "border-line bg-raised"}`}>
      <Icon className="h-5 w-5" /> {label}
    </button>
  );
}
