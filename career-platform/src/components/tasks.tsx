"use client";

import { useFormAction } from "@/components/use-form-action";
import Link from "@/components/link";
import { useEffect, useOptimistic, useRef, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { addTask, deleteTask, toggleTask } from "@/app/actions";
import type { Task } from "@/lib/types";

export function TaskList({ tasks, compact = false }: { tasks: Task[]; compact?: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(tasks, (state, upd: { id: string; done: boolean }) =>
    state.map((t) => (t.id === upd.id ? { ...t, done: upd.done } : t)));
  const [, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  if (!optimistic.length) return <p className="text-sm text-muted">No tasks. Add follow-ups as you meet people.</p>;
  return (
    <ul className="divide-y divide-line">
      {optimistic.map((t) => (
        <li key={t.id} className="flex items-start gap-3 py-2">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[rgb(var(--accent))]" checked={t.done} aria-label={`Mark "${t.title}" done`}
            onChange={(e) => start(async () => { setOptimistic({ id: t.id, done: e.target.checked }); await toggleTask(t.id, e.target.checked); })} />
          <div className="min-w-0 flex-1">
            <p className={`text-sm ${t.done ? "text-muted line-through" : ""}`}>{t.title}</p>
            <p className="text-xs text-muted">
              {t.due_at && <span className={!t.done && t.due_at < today ? "text-bad" : ""}>Due {t.due_at}{!t.done && t.due_at < today ? " · overdue" : ""}</span>}
              {t.company_name && <> · <Link className="hover:text-accent" href={`/companies/${t.company_slug}`}>{t.company_name}</Link></>}
            </p>
          </div>
          {!compact && (
            <button className="text-muted hover:text-bad" aria-label="Delete task" onClick={() => start(async () => { await deleteTask(t.id); })}>
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function AddTaskForm({ companyId, recruiterId, companies }: { companyId?: string; recruiterId?: string; companies?: { id: string; name: string }[] }) {
  const [state, onSubmit, pending] = useFormAction(addTask);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      {companyId && <input type="hidden" name="company_id" value={companyId} />}
      {recruiterId && <input type="hidden" name="recruiter_id" value={recruiterId} />}
      <label className="flex-1"><span className="label">New task</span><input name="title" required maxLength={300} className="input" placeholder="e.g. Send thank-you note to recruiter" /></label>
      {companies && !companyId && (
        <label><span className="label">Company</span>
          <select name="company_id" className="input"><option value="">—</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
      )}
      <label><span className="label">Due</span><input type="date" name="due_at" className="input" /></label>
      <button className="btn-primary" disabled={pending}>Add</button>
      {state && !state.ok && <p className="text-xs text-bad">{state.error}</p>}
    </form>
  );
}
