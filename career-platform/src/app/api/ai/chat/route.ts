import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { q } from "@/lib/db";
import { aiConfigured, complete, GROUNDING_RULES, AI_MODEL } from "@/lib/ai";
import { buildGroundingContext, prefsText } from "@/lib/context";
import { getWorkspace } from "@/lib/repo";
import { ruleBasedAnswer } from "@/lib/rules";
import { buildPrep } from "@/lib/coach";
import { scriptedMockReply } from "@/lib/mock";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  kind: z.enum(["assistant", "mock_interview"]),
  companySlug: z.string().optional(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })).min(1).max(60),
});

export async function POST(req: Request) {
  try {
    await requireUserId();
  } catch {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { kind, companySlug, messages } = parsed.data;
  if (messages[messages.length - 1].role !== "user") return NextResponse.json({ error: "Last message must be from the user" }, { status: 400 });

  const ws = await getWorkspace();
  const company = companySlug ? ws.companies.find((c) => c.slug === companySlug) : undefined;
  const question = messages[messages.length - 1].content;

  try {
    if (kind === "assistant") {
      if (!aiConfigured()) {
        const answer = ruleBasedAnswer(ws, question);
        return NextResponse.json({
          reply: answer ?? "AI isn't configured on this server (ANTHROPIC_API_KEY), so I can only answer common questions from your database: top companies to visit, aerospace or additive-manufacturing employers, documented eligibility, companies you haven't visited, follow-ups, resume gaps, or what to say to a named company. Try one of the suggestions.",
          source: answer ? "rules" : "none",
        });
      }
      const context = await buildGroundingContext(ws, company?.id);
      const reply = await complete({
        effort: "medium",
        system: `You are the user's career-intelligence analyst for the 2026 SHPE National Convention (Indianapolis, Oct 28–31, 2026). Today is ${new Date().toISOString().slice(0, 10)}.\n\n${GROUNDING_RULES}\n\n# CONTEXT\n${context}`,
        messages,
      });
      await saveThread(ws.userId, "assistant", null, [...messages, { role: "assistant", content: reply }]);
      return NextResponse.json({ reply, source: "ai", model: AI_MODEL });
    }

    if (!company) return NextResponse.json({ error: "Choose a company for the mock interview" }, { status: 400 });
    const a = ws.assessments.get(company.id)!;
    const prep = buildPrep(company, a, ws.profile.data, ws.profile.preferences, ws.jobs.get(company.id) ?? []);
    if (!aiConfigured()) {
      return NextResponse.json({ reply: scriptedMockReply(company, prep, messages), source: "rules" });
    }
    const reply = await complete({
      effort: "low",
      maxTokens: 4000,
      system: `You are role-playing a university recruiter from ${company.name} at the SHPE 2026 career fair. You are a fictional composite recruiter. Never claim to be a real named person, and never promise interviews or jobs.
Company facts you may rely on (from the user's sourced database): ${company.description ?? ""} Engineering areas: ${company.engineering_areas.join(", ")}. Focus: ${Object.values(company.tech_tags).map((t) => t!.context).join("; ")}.
Candidate settings: ${prefsText(ws.profile.preferences)}
Behave like a real, busy but friendly recruiter: ask ONE question at a time, follow up on vague answers, and ask realistic questions (background, research, why ${company.name}, a challenge, work authorization, questions for me). Keep each turn under 80 words.
When the candidate types "feedback" (or after about 6 exchanges), step out of character and give structured feedback as a markdown table scoring 1–5: Clarity, Confidence, Technical depth, Relevance, Professional communication, Follow-up questions. Then give 3 concrete improvements quoting their own words. Don't invent accomplishments for them.`,
      messages,
    });
    await saveThread(ws.userId, "mock_interview", company.id, [...messages, { role: "assistant", content: reply }]);
    return NextResponse.json({ reply, source: "ai", model: AI_MODEL });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI request failed" }, { status: 502 });
  }
}

async function saveThread(userId: string, kind: string, companyId: string | null, messages: unknown[]) {
  const existing = await q<{ id: string }>(
    `select id from chat_threads where user_id=$1 and kind=$2 and company_id is not distinct from $3 order by updated_at desc limit 1`,
    [userId, kind, companyId]);
  if (existing[0]) await q(`update chat_threads set messages=$2, updated_at=now() where id=$1`, [existing[0].id, JSON.stringify(messages)]);
  else await q(`insert into chat_threads (user_id, kind, company_id, messages) values ($1,$2,$3,$4)`, [userId, kind, companyId, JSON.stringify(messages)]);
}
