import { Card, PageHeader, Badge } from "@/components/ui";
import { getWorkspace, listDrafts } from "@/lib/repo";
import { aiConfigured } from "@/lib/ai";
import { MESSAGE_KINDS } from "@/lib/coach";
import { MessageStudio, DraftList } from "./studio";

export const metadata = { title: "LinkedIn Messaging Assistant" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ company?: string; recruiter?: string; kind?: string; interaction?: string }> }) {
  const sp = await searchParams;
  const ws = await getWorkspace();
  const drafts = await listDrafts(ws.userId);
  const ranked = [...ws.companies].sort((a, b) => ws.assessments.get(b.id)!.score - ws.assessments.get(a.id)!.score);
  const interaction = sp.interaction ? ws.interactions.find((i) => i.id === sp.interaction) : undefined;
  const notes = interaction ? [interaction.summary, interaction.opportunities_discussed].filter(Boolean).join(". ") : "";

  return (
    <div className="space-y-5">
      <PageHeader
        title="LinkedIn Messaging Assistant"
        subtitle="Draft personalized connection requests, follow-ups and thank-yous from your real background and conversation notes. Nothing is sent automatically: copy the text and send it yourself on LinkedIn."
        actions={aiConfigured() ? <Badge tone="good">AI polishing available</Badge> : <Badge>Template mode</Badge>}
      />
      <MessageStudio
        companies={ranked.map((c) => ({ id: c.id, slug: c.slug, name: c.name }))}
        recruiters={ws.recruiters.map((r) => ({ id: r.id, name: r.full_name, company_id: r.company_id, linkedin_url: r.linkedin_url }))}
        jobs={[...ws.jobs.values()].flat().map((j) => ({ id: j.id, title: j.title, company_id: j.company_id }))}
        kinds={Object.entries(MESSAGE_KINDS).map(([value, label]) => ({ value, label }))}
        initial={{ company: sp.company ?? ranked[0]?.slug ?? "", recruiter: sp.recruiter ?? "", kind: sp.kind ?? "connection", notes }}
        ai={aiConfigured()}
      />
      <Card title={`Saved drafts (${drafts.length})`}><DraftList drafts={drafts.map((d) => ({ ...d, created_at: String(d.created_at) }))} /></Card>
    </div>
  );
}
