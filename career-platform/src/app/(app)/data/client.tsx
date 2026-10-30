"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";

export function ImportForm() {
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  return (
    <form className="space-y-2" onSubmit={async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      setPending(true); setMsg(null);
      try {
        const res = await fetch("/api/import", { method: "POST", body: new FormData(form) });
        const j = await res.json();
        if (!res.ok) throw new Error([j.error, ...(j.issues ?? [])].join(" · "));
        setMsg({ ok: true, text: `Imported ${j.summary.companies} companies, ${j.summary.participation} participation records, ${j.summary.jobs} jobs, ${j.summary.recruiters} recruiters.${j.summary.warnings.length ? ` Warnings: ${j.summary.warnings.join("; ")}` : ""}` });
        form.reset();
        router.refresh();
      } catch (err) {
        setMsg({ ok: false, text: err instanceof Error ? err.message : "Import failed" });
      } finally { setPending(false); }
    }}>
      <input type="file" name="file" accept=".json,.csv,application/json,text/csv" required className="input" aria-label="Dataset file" />
      <button className="btn-primary w-full" disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import</button>
      {msg && <p className={`text-xs ${msg.ok ? "text-good" : "text-bad"}`} role="status">{msg.text}</p>}
    </form>
  );
}
