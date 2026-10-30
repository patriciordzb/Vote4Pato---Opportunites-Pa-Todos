"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { updateCompanyTracking } from "@/app/actions";
import { Badge, VerificationBadge, ROLE_LABEL } from "@/components/ui";
import { CopyButton } from "@/components/client";

export interface ChecklistItem {
  id: string; slug: string; name: string; booth: string | null; verification: "verified" | "partially_verified" | "unverified"; role: string;
  score: number; tier: number; label: string; pitch: string; question: string; visited: boolean; order: number | null;
}

export function BoothChecklist({ items }: { items: ChecklistItem[] }) {
  const [state, setState] = useState(() => Object.fromEntries(items.map((i) => [i.id, i.visited])));
  const [showAll, setShowAll] = useState(false);
  const [, start] = useTransition();
  const visible = showAll ? items : items.filter((i) => i.tier <= 3);
  const done = items.filter((i) => state[i.id]).length;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs text-muted">
        <span>{done}/{items.length} visited</span>
        <button className="text-accent hover:underline" onClick={() => setShowAll((s) => !s)}>{showAll ? "Show priority booths only" : `Show all ${items.length}`}</button>
      </div>
      <ol className="space-y-2">
        {visible.map((i, idx) => (
          <li key={i.id} className={`rounded-lg border p-3 transition ${state[i.id] ? "border-good/40 bg-good/5" : "border-line"}`}>
            <div className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-[rgb(var(--good))]" checked={state[i.id]} aria-label={`Visited ${i.name}`}
                onChange={(e) => { const v = e.target.checked; setState((s) => ({ ...s, [i.id]: v })); start(async () => { await updateCompanyTracking(i.id, { visited: v }); }); }} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs tabular-nums text-muted">{i.order ?? idx + 1}.</span>
                  <Link href={`/companies/${i.slug}`} className={`font-medium hover:text-accent ${state[i.id] ? "line-through opacity-70" : ""}`}>{i.name}</Link>
                  {i.booth ? <Badge tone="accent">Booth #{i.booth}</Badge> : <Badge>Booth: check SHPE app</Badge>}
                  <VerificationBadge level={i.verification} title={ROLE_LABEL[i.role]} />
                  <Badge tone={i.tier === 1 ? "good" : "neutral"}>{i.score} · {i.label}</Badge>
                </div>
                <p className="mt-1.5 text-sm"><span className="text-xs font-medium uppercase text-muted">Say: </span>{i.pitch}</p>
                <p className="mt-1 text-sm"><span className="text-xs font-medium uppercase text-muted">Ask: </span>{i.question}</p>
                <div className="mt-1"><CopyButton text={i.pitch} label="Copy pitch" className="text-xs text-accent inline-flex items-center gap-1" /></div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
