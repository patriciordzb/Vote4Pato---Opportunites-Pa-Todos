import { Linkedin, ShieldCheck } from "lucide-react";
import { Badge, Card, PageHeader, SetupNotice, Bar, ComputedLabel, fmtDate, ExtLink } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { AiGenerate } from "@/components/forms";
import { getLinkedIn, getWorkspace, listDocuments } from "@/lib/repo";
import { linkedinConfig, LINKEDIN_SCOPES } from "@/lib/linkedin";
import { domainLabel } from "@/lib/intel";
import { disconnectLinkedIn, deleteMyData } from "@/app/actions";
import { DocumentUpload, DocumentRow, PreferencesForm, ProfileEditor } from "./client";

export const metadata = { title: "Profile & LinkedIn" };

const LI_MESSAGES: Record<string, { tone: "good" | "bad" | "warn"; text: string }> = {
  connected: { tone: "good", text: "LinkedIn connected. Your basic profile (name, photo, email) was imported." },
  cancelled: { tone: "warn", text: "LinkedIn authorization was cancelled." },
  denied: { tone: "bad", text: "LinkedIn denied the authorization request." },
  state_mismatch: { tone: "bad", text: "Security check failed (state mismatch). Please try again." },
  nonce_mismatch: { tone: "bad", text: "Security check failed (nonce mismatch). Please try again." },
  error: { tone: "bad", text: "Could not complete the LinkedIn connection. Check the server logs and your LinkedIn app settings." },
  not_configured: { tone: "warn", text: "LinkedIn isn't configured on this server yet. See the setup steps below." },
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ linkedin?: string }> }) {
  const { linkedin: liStatus } = await searchParams;
  const ws = await getWorkspace();
  const [li, docs] = await Promise.all([getLinkedIn(ws.userId), listDocuments(ws.userId)]);
  const cfg = linkedinConfig();
  const intel = ws.intel;
  const notice = liStatus ? LI_MESSAGES[liStatus] : null;

  return (
    <div className="space-y-5">
      <PageHeader title="LinkedIn & Professional Profile" subtitle="Your approved profile powers every score, pitch and message. Nothing extracted from an upload changes your profile until you approve it." />
      {notice && <div className={`rounded-lg border p-3 text-sm ${notice.tone === "good" ? "border-good/40 bg-good/10 text-good" : notice.tone === "bad" ? "border-bad/40 bg-bad/10 text-bad" : "border-warn/40 bg-warn/10 text-warn"}`} role="status">{notice.text}</div>}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="LinkedIn account" className="lg:col-span-1" action={li ? <Badge tone="good">Connected</Badge> : <Badge>Not connected</Badge>}>
          {li ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {li.picture_url
                  ? <img src={li.picture_url} alt="" className="h-12 w-12 rounded-full border border-line" referrerPolicy="no-referrer" /> // eslint-disable-line @next/next/no-img-element
                  : <div className="grid h-12 w-12 place-items-center rounded-full bg-raised"><Linkedin className="h-5 w-5" /></div>}
                <div><p className="font-medium">{li.name}</p><p className="text-xs text-muted">{li.email}{li.email_verified ? " · verified" : ""}</p></div>
              </div>
              <p className="text-xs text-muted">Connected {fmtDate(li.connected_at)} · scopes: {li.scopes} · token expires {fmtDate(li.token_expires_at)}</p>
              <ActionButton action={disconnectLinkedIn} confirm="Disconnect LinkedIn and delete the stored access token?" className="btn-danger">Disconnect LinkedIn</ActionButton>
            </div>
          ) : cfg ? (
            <a href="/api/linkedin/connect" className="btn w-full bg-[#0a66c2] text-white hover:brightness-110"><Linkedin className="h-4 w-4" /> Connect with LinkedIn</a>
          ) : (
            <SetupNotice title="LinkedIn sign-in not configured">
              Create an app at <ExtLink href="https://www.linkedin.com/developers/apps">linkedin.com/developers</ExtLink>, add the &quot;Sign In with LinkedIn using OpenID Connect&quot; product, set the redirect URL to <code>{"{APP_URL}"}/api/linkedin/callback</code>, then set <code>LINKEDIN_CLIENT_ID</code>, <code>LINKEDIN_CLIENT_SECRET</code> and <code>APP_URL</code>.
            </SetupNotice>
          )}
          <div className="mt-4 rounded-lg bg-raised/50 p-3 text-xs text-muted">
            <p className="mb-1 flex items-center gap-1 font-medium text-fg"><ShieldCheck className="h-3.5 w-3.5" /> What LinkedIn shares</p>
            Scopes <code>{LINKEDIN_SCOPES.join(" ")}</code> give your name, photo, email and member ID only. LinkedIn does not share your work history, education, skills, connections or messages with standard apps. Import those through your LinkedIn PDF (LinkedIn → your profile → More → Save to PDF) or resume. This app never asks for your LinkedIn password and never posts or messages for you.
          </div>
        </Card>

        <Card title="Upload documents" subtitle="Resume, LinkedIn profile PDF, research posters, portfolio, publications. PDF only, max 10 MB." className="lg:col-span-2">
          <DocumentUpload />
          <ul className="mt-4 space-y-3">
            {docs.map((d) => <DocumentRow key={d.id} doc={{ ...d, created_at: String(d.created_at) }} />)}
            {!docs.length && <li className="text-sm text-muted">No documents yet. Your starting profile came from the resume and poster you shared. Upload them here to keep the originals with your profile.</li>}
          </ul>
        </Card>
      </div>

      <Card title="AI analysis of your experience" subtitle="Professional intelligence profile computed from your approved profile. It powers all matching." action={<ComputedLabel />}>
        <div className="grid gap-5 lg:grid-cols-3">
          <div>
            <p className="label">Top technical strengths</p>
            <ul className="space-y-2">
              {intel.topStrengths.map((s) => (
                <li key={s.key}>
                  <div className="flex justify-between text-sm"><span>{domainLabel(s.key)}</span><span className="text-xs text-muted">{Math.round(s.strength * 100)}</span></div>
                  <Bar value={s.strength * 100} tone="good" />
                  <p className="mt-0.5 truncate text-[11px] text-muted" title={s.evidence.map((e) => e.label).join("; ")}>{s.evidence.slice(0, 2).map((e) => e.label).join(" · ")}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label">Best-fit career paths</p>
            <ul className="space-y-2 text-sm">{intel.careerPaths.map((c) => <li key={c.title}><p className="font-medium">{c.title}</p><p className="text-xs text-muted">{c.why}</p></li>)}</ul>
            <p className="label mt-4">Transferable skills</p>
            <ul className="list-disc space-y-1 pl-5 text-sm">{intel.transferable.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <div>
            <p className="label">Potential skill gaps</p>
            <ul className="list-disc space-y-1 pl-5 text-sm">{intel.gaps.map((g) => <li key={g.key}><span className="font-medium">{domainLabel(g.key)}:</span> {g.reason}</li>)}</ul>
            <p className="label mt-4">Profile completeness: {intel.completeness.score}%</p>
            {intel.completeness.missing.length > 0 && <p className="text-xs text-muted">Missing: {intel.completeness.missing.join(", ")}</p>}
          </div>
        </div>
      </Card>

      <Card title="LinkedIn profile improvements">
        <AiGenerate aiEnabled payload={{ task: "profile_improve" }} label="Generate suggestions" />
      </Card>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card title={<span id="preferences">Career preferences & work eligibility</span>} subtitle="Used only to compare against requirements that postings state explicitly. Never shared." className="lg:col-span-2">
          <PreferencesForm prefs={ws.profile.preferences} />
        </Card>
        <Card title="Edit professional profile" subtitle={`Version ${ws.profile.version} · last approved ${fmtDate(ws.profile.updatedAt)}`} className="lg:col-span-3">
          <ProfileEditor data={ws.profile.data} />
        </Card>
      </div>

      <Card title="Privacy & data controls">
        <div className="flex flex-wrap gap-2">
          <a href="/api/export" className="btn-ghost">Download my data (JSON)</a>
          <ActionButton action={deleteMyData.bind(null, "documents")} confirm="Permanently delete all uploaded documents?" className="btn-danger">Delete uploaded documents</ActionButton>
          <ActionButton action={deleteMyData.bind(null, "networking")} confirm="Permanently delete all CRM data, notes, tasks, applications, drafts and recruiters you added?" className="btn-danger">Delete networking data</ActionButton>
          <ActionButton action={deleteMyData.bind(null, "everything")} confirm="Permanently delete EVERYTHING: profile, documents, LinkedIn connection and all networking data?" className="btn-danger">Delete all my data</ActionButton>
        </div>
        <p className="mt-2 text-xs text-muted">Deletion is immediate and permanent. To revoke this app&apos;s LinkedIn access on LinkedIn&apos;s side, visit <ExtLink href="https://www.linkedin.com/psettings/permitted-services">Permitted services</ExtLink>.</p>
      </Card>
    </div>
  );
}
