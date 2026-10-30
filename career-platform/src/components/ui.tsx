import Link from "@/components/link";
import type { ReactNode } from "react";
import { ShieldCheck, ShieldAlert, ShieldQuestion, Sparkles, ExternalLink } from "lucide-react";
import type { Verification } from "@/lib/types";
import { ELIGIBILITY_LABEL, type EligibilityStatus } from "@/lib/eligibility";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ children, className, title, action, subtitle }: { children: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx("card p-4 sm:p-5 animate-fade-in", className)}>
      {(title || action) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-fg">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

type Tone = "neutral" | "accent" | "good" | "warn" | "bad" | "info";
const TONE: Record<Tone, string> = {
  neutral: "bg-raised text-muted border border-line",
  accent: "bg-accent/15 text-accent",
  good: "bg-good/15 text-good",
  warn: "bg-warn/15 text-warn",
  bad: "bg-bad/15 text-bad",
  info: "bg-info/15 text-info",
};

export function Badge({ children, tone = "neutral", className, title }: { children: ReactNode; tone?: Tone; className?: string; title?: string }) {
  return <span title={title} className={cx("chip", TONE[tone], className)}>{children}</span>;
}

const VERIFICATION: Record<Verification, { label: string; tone: Tone; Icon: typeof ShieldCheck }> = {
  verified: { label: "Verified", tone: "good", Icon: ShieldCheck },
  partially_verified: { label: "Partially verified", tone: "warn", Icon: ShieldAlert },
  unverified: { label: "Unverified", tone: "neutral", Icon: ShieldQuestion },
  ai_analysis: { label: "AI analysis", tone: "info", Icon: Sparkles },
};

export function VerificationBadge({ level, title }: { level: Verification; title?: string }) {
  const v = VERIFICATION[level];
  return (
    <Badge tone={v.tone} title={title ?? v.label}>
      <v.Icon className="h-3 w-3" aria-hidden /> {v.label}
    </Badge>
  );
}

export function AiLabel({ children = "AI analysis" }: { children?: ReactNode }) {
  return <Badge tone="info"><Sparkles className="h-3 w-3" aria-hidden />{children}</Badge>;
}

export function ComputedLabel() {
  return <Badge tone="neutral" title="Computed by the rule-based engine from your profile and the sourced database">Computed analysis</Badge>;
}

const ELIG_TONE: Record<EligibilityStatus, Tone> = {
  confirmed_eligible: "good",
  potentially_eligible: "accent",
  requires_clarification: "warn",
  explicit_restriction: "bad",
  insufficient_information: "neutral",
};

export function EligibilityBadge({ status }: { status: EligibilityStatus }) {
  return <Badge tone={ELIG_TONE[status]}>{ELIGIBILITY_LABEL[status]}</Badge>;
}

export function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const tone: Tone = level === "high" ? "good" : level === "medium" ? "warn" : "neutral";
  return <Badge tone={tone}>Confidence: {level}</Badge>;
}

export function scoreTone(score: number): Tone {
  return score >= 70 ? "good" : score >= 50 ? "accent" : score >= 35 ? "warn" : "neutral";
}

export function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 70 ? "rgb(var(--good))" : score >= 50 ? "rgb(var(--accent))" : score >= 35 ? "rgb(var(--warn))" : "rgb(var(--muted))";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Compatibility ${score} of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(var(--line))" strokeWidth={5} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={5} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-semibold tabular-nums">{score}</span>
    </div>
  );
}

export function Bar({ value, max = 100, tone = "accent" }: { value: number; max?: number; tone?: Tone }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const bg = tone === "good" ? "bg-good" : tone === "warn" ? "bg-warn" : tone === "bad" ? "bg-bad" : tone === "neutral" ? "bg-muted" : "bg-accent";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
      <div className={cx("h-full rounded-full transition-all", bg)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stat({ label, value, hint, href }: { label: string; value: ReactNode; hint?: ReactNode; href?: string }) {
  const body = (
    <div className="card h-full p-4 transition hover:border-accent/50">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line p-6 text-center">
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

export function ExtLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cx("inline-flex items-center gap-1 text-accent hover:underline", className)}>
      {children}
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}

export function SetupNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm">
      <p className="font-medium text-warn">{title}</p>
      <div className="mt-1 text-muted">{children}</div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const ROLE_LABEL: Record<string, string> = {
  exhibitor: "Exhibitor",
  sponsor: "Sponsor",
  ipc_partner: "SHPE IPC partner",
  event_partner: "Event partner",
  academic_partner: "Academic partner",
  historical: "Past participant",
};

export function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d.length === 10 ? `${d}T12:00:00` : d) : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
