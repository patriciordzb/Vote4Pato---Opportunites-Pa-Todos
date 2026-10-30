import { Card, PageHeader, Badge, ComputedLabel } from "@/components/ui";
import { CopyButton, Disclosure } from "@/components/client";
import { Chat } from "@/components/chat";
import { AiGenerate } from "@/components/forms";
import { getWorkspace } from "@/lib/repo";
import { buildPrep } from "@/lib/coach";
import { aiConfigured } from "@/lib/ai";
import { CompanyPicker } from "./picker";

export const metadata = { title: "Recruiter Conversation Coach" };

export default async function CoachPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const sp = await searchParams;
  const ws = await getWorkspace();
  const ranked = [...ws.companies].sort((a, b) => ws.assessments.get(b.id)!.score - ws.assessments.get(a.id)!.score);
  const company = ranked.find((c) => c.slug === sp.company) ?? ranked[0];
  const a = ws.assessments.get(company.id)!;
  const prep = buildPrep(company, a, ws.profile.data, ws.profile.preferences, ws.jobs.get(company.id) ?? []);
  const ai = aiConfigured();

  return (
    <div className="space-y-5">
      <PageHeader title="Recruiter Conversation Coach" subtitle="Pitches, technical talking points, questions, tough-question answers, and a mock recruiter for practice." />
      <CompanyPicker companies={ranked.map((c) => ({ slug: c.slug, name: c.name, score: ws.assessments.get(c.id)!.score }))} value={company.slug} />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Card title={`A · Elevator pitches for ${company.name}`} action={<ComputedLabel />}>
            {([["15-second", prep.pitch15], ["30-second", prep.pitch30], ["60-second", prep.pitch60]] as const).map(([l, t]) => (
              <div key={l} className="mb-3">
                <div className="mb-1 flex items-center justify-between"><span className="label mb-0">{l}</span><CopyButton text={t} className="text-xs text-accent inline-flex items-center gap-1" /></div>
                <p className="rounded-lg bg-raised/60 p-2.5 text-sm leading-relaxed">{t}</p>
              </div>
            ))}
            <AiGenerate aiEnabled={ai} payload={{ task: "pitch", companySlug: company.slug }} label="Make it sound more natural (AI)" />
          </Card>
          <Card title="B · Technical talking points">
            {prep.talkingPoints.length ? <ul className="space-y-2 text-sm">{prep.talkingPoints.map((t) => <li key={t.topic}><span className="font-medium">{t.topic}.</span> <span className="text-muted">{t.detail}</span></li>)}</ul>
              : <p className="text-sm text-muted">This company&apos;s documented work has little technical overlap with your research. Use transferable strengths instead.</p>}
          </Card>
          <Card title="C · Questions for the recruiter">
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">{prep.questions.map((q) => <li key={q}>{q}</li>)}</ol>
          </Card>
          <Card title="D · Handling challenging questions" subtitle="Grounded in your profile. Edit anything that doesn't sound like you.">
            <div className="space-y-2">
              {prep.hardQuestions.map((h) => (
                <Disclosure key={h.q} summary={h.q}>
                  <p className="leading-relaxed">{h.a}</p>
                  <div className="mt-1"><CopyButton text={h.a} className="text-xs text-accent inline-flex items-center gap-1" /></div>
                </Disclosure>
              ))}
            </div>
          </Card>
        </div>
        <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">E · Mock recruiter conversation</h2>{ai ? <Badge tone="good">AI recruiter</Badge> : <Badge>Scripted practice mode</Badge>}</div>
          <Chat key={company.slug} kind="mock_interview" companySlug={company.slug} suggestions={["Hi! I'm ready to start."]}
            intro={`You're at the ${company.name} booth. The recruiter is a fictional composite, not a real person. Answer as you would in person. Type "feedback" any time for scores on clarity, confidence, technical depth, relevance, professional communication and follow-up questions.`} />
        </div>
      </div>
    </div>
  );
}
