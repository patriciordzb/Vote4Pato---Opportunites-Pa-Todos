"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  LayoutDashboard, Building2, Users, Briefcase, KanbanSquare, Map, MessageSquareText, Bot, UserCircle2, Database,
  Smartphone, Mic, Menu, X, Sun, Moon, LogOut, Search,
} from "lucide-react";
import { setTheme, signOut } from "@/app/actions";

const NAV = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/companies", label: "Company Explorer", Icon: Building2 },
  { href: "/recruiters", label: "Recruiters", Icon: Users },
  { href: "/jobs", label: "Job Tracker", Icon: Briefcase },
  { href: "/crm", label: "Networking CRM", Icon: KanbanSquare },
  { href: "/strategy", label: "Convention Strategy", Icon: Map },
  { href: "/coach", label: "Recruiter Coach", Icon: Mic },
  { href: "/messages", label: "LinkedIn Messages", Icon: MessageSquareText },
  { href: "/assistant", label: "AI Career Assistant", Icon: Bot },
  { href: "/profile", label: "Profile & LinkedIn", Icon: UserCircle2 },
  { href: "/data", label: "Data & Sources", Icon: Database },
];

export function Shell({ children, status }: { children: React.ReactNode; status: { ai: boolean; linkedin: boolean; dark: boolean; local: boolean; name: string } }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  useEffect(() => setOpen(false), [pathname]);

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {NAV.map(({ href, label, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link key={href} href={href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-accent/15 font-medium text-accent" : "text-muted hover:bg-raised hover:text-fg"}`}
            aria-current={active ? "page" : undefined}>
            <Icon className="h-4 w-4" aria-hidden /> {label}
          </Link>
        );
      })}
      <Link href="/fair" className="mt-3 flex items-center gap-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-medium text-accent hover:bg-accent/20">
        <Smartphone className="h-4 w-4" aria-hidden /> Career-Fair Mode
      </Link>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden border-r border-line bg-panel/60 lg:block">
        <div className="sticky top-0 flex h-screen flex-col p-4">
          <Brand />
          <div className="mt-6 flex-1 overflow-y-auto">{nav}</div>
          <StatusChips status={status} />
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-black/50" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-panel p-4 shadow-xl">
            <div className="flex items-center justify-between"><Brand /><button className="btn-ghost p-2" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-4 w-4" /></button></div>
            <div className="mt-6 flex-1 overflow-y-auto">{nav}</div>
            <StatusChips status={status} />
          </div>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-bg/85 px-4 py-2.5 backdrop-blur sm:px-6">
          <button className="btn-ghost p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-4 w-4" /></button>
          <form action="/companies" className="relative max-w-md flex-1" role="search">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input name="q" placeholder="Search companies, technologies, booths…" className="input pl-9" aria-label="Search companies" />
          </form>
          <div className="ml-auto flex items-center gap-2">
            {status.local && <span className="chip hidden bg-warn/15 text-warn sm:inline-flex" title="APP_PASSWORD is not set; local development mode">Local mode</span>}
            <button className="btn-ghost p-2" aria-label="Toggle theme" onClick={() => start(async () => { await setTheme(status.dark ? "light" : "dark"); router.refresh(); })}>
              {status.dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <form action={signOut}><button className="btn-ghost p-2" aria-label="Sign out" title="Sign out"><LogOut className="h-4 w-4" /></button></form>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 text-accent">
        <svg viewBox="0 0 64 64" className="h-5 w-5" aria-hidden><path d="M14 44 L32 14 L50 44" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /><circle cx="32" cy="50" r="5" fill="currentColor" /></svg>
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold">SHPE 2026</span>
        <span className="block text-[11px] text-muted">Career Intelligence Command Center</span>
      </span>
    </Link>
  );
}

function StatusChips({ status }: { status: { ai: boolean; linkedin: boolean; name: string } }) {
  return (
    <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-xs">
      <p className="truncate font-medium">{status.name}</p>
      <p className={status.linkedin ? "text-good" : "text-muted"}>● LinkedIn {status.linkedin ? "connected" : "not connected"}</p>
      <p className={status.ai ? "text-good" : "text-muted"}>● AI {status.ai ? "configured" : "not configured"}</p>
    </div>
  );
}
