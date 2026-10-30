"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, SendHorizonal, RotateCcw } from "lucide-react";
import { Markdown } from "./forms";

interface Msg { role: "user" | "assistant"; content: string; source?: string }

export function Chat({ kind, companySlug, suggestions = [], intro, initial = [] }: {
  kind: "assistant" | "mock_interview"; companySlug?: string; suggestions?: string[]; intro: string; initial?: Msg[];
}) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, pending]);
  useEffect(() => { setMessages(initial); }, [companySlug]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, companySlug, messages: next.slice(-40).map(({ role, content }) => ({ role, content })) }),
      });
      if (res.status === 401) return router.push("/login");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Request failed");
      setMessages([...next, { role: "assistant", content: j.reply, source: j.source }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-[min(70vh,680px)] flex-col rounded-xl border border-line bg-panel">
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        <div className="rounded-lg bg-raised/50 p-3 text-sm text-muted">{intro}</div>
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ml-auto max-w-[85%] rounded-lg bg-accent px-3 py-2 text-sm text-accent-fg" : "max-w-[92%] rounded-lg border border-line bg-raised/40 px-3 py-2"}>
            {m.role === "assistant" ? (
              <>
                {m.source && <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">{m.source === "ai" ? "AI-generated · check [Sourced] tags" : m.source === "rules" ? "Computed from your database (no AI)" : "System"}</p>}
                <Markdown text={m.content} />
              </>
            ) : <p className="whitespace-pre-wrap">{m.content}</p>}
          </div>
        ))}
        {pending && <div className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Thinking…</div>}
        {error && <p className="text-sm text-bad" role="alert">{error}</p>}
        <div ref={endRef} />
      </div>
      {suggestions.length > 0 && messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-line px-3 py-2">
          {suggestions.map((s) => <button key={s} className="chip border border-line bg-raised text-fg hover:border-accent" onClick={() => send(s)}>{s}</button>)}
        </div>
      )}
      <form className="flex gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <button type="button" className="btn-ghost p-2" title="New conversation" aria-label="New conversation" onClick={() => { setMessages([]); setError(null); }}><RotateCcw className="h-4 w-4" /></button>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} className="input min-h-[42px] resize-none"
          placeholder={kind === "mock_interview" ? "Answer the recruiter… (type 'feedback' to finish)" : "Ask about companies, recruiters, eligibility, follow-ups…"}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} aria-label="Message" />
        <button className="btn-primary" disabled={pending || !input.trim()} aria-label="Send"><SendHorizonal className="h-4 w-4" /></button>
      </form>
    </div>
  );
}
