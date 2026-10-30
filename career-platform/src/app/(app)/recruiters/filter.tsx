"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RecruiterFilter({ q, status }: { q: string; status: string }) {
  const router = useRouter();
  const [text, setText] = useState(q);
  const go = (next: { q?: string; status?: string }) => {
    const p = new URLSearchParams();
    const qq = next.q ?? text;
    const st = next.status ?? status;
    if (qq) p.set("q", qq);
    if (st) p.set("status", st);
    router.replace(`/recruiters${p.size ? `?${p}` : ""}`);
  };
  return (
    <form className="card flex flex-col gap-2 p-3 sm:flex-row" onSubmit={(e) => { e.preventDefault(); go({}); }}>
      <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search name, company, specialty…" aria-label="Search recruiters" />
      <select className="input sm:w-56" value={status} onChange={(e) => go({ status: e.target.value })} aria-label="Attendance filter">
        <option value="">All recruiters</option>
        <option value="confirmed">Confirmed attending</option>
        <option value="potential">Potential contacts</option>
        <option value="unverified">Unverified</option>
        <option value="saved">Saved</option>
      </select>
      <button className="btn-primary">Search</button>
    </form>
  );
}
