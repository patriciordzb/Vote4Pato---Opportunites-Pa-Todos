import { PageHeader, SetupNotice, Badge } from "@/components/ui";
import { Chat } from "@/components/chat";
import { aiConfigured, AI_MODEL } from "@/lib/ai";
import { q1 } from "@/lib/db";
import { getOwnerId } from "@/lib/repo";

export const metadata = { title: "AI Career Assistant" };

const SUGGESTIONS = [
  "Which aerospace companies should I visit first?",
  "Which employers have roles related to additive manufacturing?",
  "Which companies have documented non-citizen eligibility?",
  "How does my GRX-810 research relate to GE Aerospace's work?",
  "Which companies have I not visited yet?",
  "Which recruiters should I follow up with?",
  "What should I improve on my resume?",
];

export default async function AssistantPage() {
  const ai = aiConfigured();
  const userId = await getOwnerId();
  const thread = await q1<{ messages: { role: "user" | "assistant"; content: string }[] }>(
    `select messages from chat_threads where user_id=$1 and kind='assistant' order by updated_at desc limit 1`, [userId]);
  return (
    <div className="space-y-4">
      <PageHeader
        title="AI Career Assistant"
        subtitle="Answers come from your profile, the sourced company database, and your own networking notes. Sourced facts are tagged [Sourced]; recommendations are tagged [AI advice]."
        actions={ai ? <Badge tone="good">AI: {AI_MODEL}</Badge> : <Badge>Rule-based mode</Badge>}
      />
      {!ai && (
        <SetupNotice title="AI not configured">
          <code>ANTHROPIC_API_KEY</code> isn&apos;t set on the server. The assistant still answers the common questions below by computing directly from your database. Add the key (see README) for open-ended answers.
        </SetupNotice>
      )}
      <Chat kind="assistant" suggestions={SUGGESTIONS} initial={ai ? (thread?.messages ?? []).map((m) => ({ ...m, source: m.role === "assistant" ? "ai" : undefined })) : []}
        intro="Hi! I know your profile, every company in your SHPE 2026 database (with its verification level), your CRM notes and tasks. Ask me what to do next." />
    </div>
  );
}
