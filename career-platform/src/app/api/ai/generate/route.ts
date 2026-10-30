import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { aiConfigured, complete, GROUNDING_RULES } from "@/lib/ai";
import { buildMessage, buildPrep, MESSAGE_KINDS, type MessageKind } from "@/lib/coach";
import { getWorkspace } from "@/lib/repo";
import { matchJob } from "@/lib/scoring";
import { profileToText } from "@/lib/intel";
import { prefsText } from "@/lib/context";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.discriminatedUnion("task", [
  z.object({
    task: z.literal("message"),
    kind: z.enum(Object.keys(MESSAGE_KINDS) as [MessageKind, ...MessageKind[]]),
    companySlug: z.string(),
    recruiterId: z.string().uuid().optional().nullable(),
    jobId: z.string().uuid().optional().nullable(),
    notes: z.string().max(4000).optional(),
    mode: z.enum(["template", "ai"]).default("template"),
  }),
  z.object({ task: z.literal("pitch"), companySlug: z.string() }),
  z.object({ task: z.literal("profile_improve") }),
  z.object({ task: z.literal("resume_match"), jobId: z.string().uuid() }),
]);

export async function POST(req: Request) {
  try {
    await requireUserId();
  } catch {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const body = parsed.data;
  const ws = await getWorkspace();
  const profileText = profileToText(ws.profile.data);

  try {
    if (body.task === "message") {
      const company = ws.companies.find((c) => c.slug === body.companySlug);
      if (!company) return NextResponse.json({ error: "Unknown company" }, { status: 404 });
      const recruiter = body.recruiterId ? ws.recruiters.find((r) => r.id === body.recruiterId) ?? null : null;
      const job = body.jobId ? (ws.jobs.get(company.id) ?? []).find((j) => j.id === body.jobId) ?? null : null;
      const a = ws.assessments.get(company.id)!;
      const template = buildMessage({
        kind: body.kind, profile: ws.profile.data, company, recruiter, job, conversationNotes: body.notes,
        matchedContext: a.matchedDomains[0]?.context,
      });
      if (body.mode === "template") return NextResponse.json({ text: template, source: "template" });
      if (!aiConfigured()) return NextResponse.json({ text: template, source: "template", notice: "AI isn't configured, so this is the template draft." });
      const text = await complete({
        effort: "low",
        maxTokens: 2000,
        system: `You write concise, warm, professional LinkedIn messages and emails for an engineering student. ${GROUNDING_RULES.split("\n").slice(1, 2).join("")}\nUse only facts from the profile, company record and conversation notes. Do not use [Sourced]/[AI advice] labels in the message itself. Do not invent shared connections, conversations or accomplishments. ${body.kind === "connection" ? "HARD LIMIT: 300 characters (LinkedIn connection note)." : "Keep it under 170 words."} Output only the message text.`,
        messages: [{
          role: "user",
          content: `Message type: ${MESSAGE_KINDS[body.kind]}\nCompany: ${company.name} — ${company.description}\nWhy the student fits: ${a.matchedDomains.slice(0, 3).map((m) => `${m.evidence} ↔ ${m.context}`).join("; ")}\nRecruiter: ${recruiter ? `${recruiter.full_name}, ${recruiter.title ?? ""}` : "unknown name"}\nJob: ${job ? `${job.title} ${job.requisition_id ?? ""}` : "none specified"}\nConversation notes from the student: ${body.notes || "none"}\n\nStudent profile:\n${profileText}\n\nTemplate draft to improve:\n${template}`,
        }],
      });
      return NextResponse.json({ text: body.kind === "connection" ? text.slice(0, 300) : text, source: "ai" });
    }

    if (body.task === "pitch") {
      if (!aiConfigured()) return NextResponse.json({ error: "AI is not configured (ANTHROPIC_API_KEY). The template pitches above still work." }, { status: 503 });
      const company = ws.companies.find((c) => c.slug === body.companySlug);
      if (!company) return NextResponse.json({ error: "Unknown company" }, { status: 404 });
      const a = ws.assessments.get(company.id)!;
      const prep = buildPrep(company, a, ws.profile.data, ws.profile.preferences, ws.jobs.get(company.id) ?? []);
      const text = await complete({
        effort: "medium",
        maxTokens: 3000,
        system: "You coach an engineering student for career-fair conversations. Rewrite the pitches so they sound natural when spoken aloud, keep every fact exactly as given, and add nothing new. Output markdown with headings: 15-second, 30-second, 60-second.",
        messages: [{ role: "user", content: `Company: ${company.name}. Company focus: ${Object.values(company.tech_tags).map((t) => t!.context).join("; ")}\n\nStudent profile:\n${profileText}\n\nDrafts:\n15s: ${prep.pitch15}\n30s: ${prep.pitch30}\n60s: ${prep.pitch60}` }],
      });
      return NextResponse.json({ text, source: "ai" });
    }

    if (body.task === "profile_improve") {
      const deterministic = [
        `Headline idea: "Aerospace & Mechanical Engineering @ UTEP | Metal AM (LPBF) & high-temperature alloys research with NASA | Founder, ASCENT Lab | CSWP"`,
        "Put a number in each experience entry (50+ GRX-810 parts, $250K savings, 24 engineers, 400+ students).",
        "Add the SFF 2026 papers to LinkedIn under Publications, and the SHPE 2026 poster under Featured.",
        "List skills recruiters search for: Additive Manufacturing, Materials Characterization, SEM, EBSD, Tensile Testing, SolidWorks, ANSYS, Python.",
        "Set 'Open to work' (visible to recruiters only) with internship/co-op and your target locations.",
      ];
      if (!aiConfigured()) return NextResponse.json({ text: deterministic.map((d) => `- ${d}`).join("\n"), source: "rules" });
      const text = await complete({
        effort: "medium",
        maxTokens: 4000,
        system: "You are a LinkedIn profile coach for engineering students targeting aerospace, advanced manufacturing and materials roles. Ground every suggestion in the profile provided. Never invent experience. Output markdown: Headline (3 options, max 220 chars), About section draft (max 1,300 chars), Experience bullet rewrites, Skills to add (from the profile only), and 3 quick wins.",
        messages: [{ role: "user", content: `Profile:\n${profileText}\n\nCareer settings: ${prefsText(ws.profile.preferences)}` }],
      });
      return NextResponse.json({ text, source: "ai" });
    }

    // resume_match
    const job = [...ws.jobs.values()].flat().find((j) => j.id === body.jobId);
    if (!job) return NextResponse.json({ error: "Unknown job" }, { status: 404 });
    const match = matchJob(job, ws.intel, ws.profile.preferences);
    let ai: string | null = null;
    if (aiConfigured()) {
      ai = await complete({
        effort: "medium",
        maxTokens: 4000,
        system: `You compare a student's resume/profile against a job posting. ${GROUNDING_RULES}\nOutput markdown with: Matching qualifications, Missing or unclear qualifications, Eligibility requirements stated in the posting (quote them; do not judge legal eligibility), and 3–5 specific resume edits that use only true facts from the profile.`,
        messages: [{ role: "user", content: `JOB: ${job.title} at ${job.company_name}\nLocation: ${job.location}\nDescription: ${job.description}\nQualifications: ${job.qualifications.join("; ")}\nEligibility: ${JSON.stringify(job.eligibility)}\n\nPROFILE:\n${profileText}` }],
      });
    }
    return NextResponse.json({ match, ai, source: ai ? "ai" : "rules" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Generation failed" }, { status: 502 });
  }
}
