"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Check, Copy, Loader2 } from "lucide-react";

export function CompanyLogo({ name, domain, size = 40 }: { name: string; domain?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // The image may have failed before hydration attached onError.
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth === 0) setFailed(true);
  }, []);
  const initials = name.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  if (domain && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={img}
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="shrink-0 rounded-lg border border-line bg-white object-contain p-1"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div className="grid shrink-0 place-items-center rounded-lg border border-line bg-raised text-xs font-semibold text-accent" style={{ width: size, height: size }} aria-hidden>
      {initials}
    </div>
  );
}

export function CopyButton({ text, label = "Copy", className = "btn-ghost" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {done ? "Copied" : label}
    </button>
  );
}

/** Button that runs a server action with a pending state and optional confirm prompt. */
export function ActionButton({
  action, children, className = "btn-ghost", confirm, title,
}: { action: () => Promise<unknown>; children: ReactNode; className?: string; confirm?: string; title?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      title={title}
      className={className}
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          await action();
        });
      }}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Disclosure({ summary, children, defaultOpen = false }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group rounded-lg border border-line bg-raised/40 p-3" open={defaultOpen}>
      <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">
        <span className="mr-1 inline-block transition group-open:rotate-90">›</span>
        {summary}
      </summary>
      <div className="mt-2 text-sm">{children}</div>
    </details>
  );
}
