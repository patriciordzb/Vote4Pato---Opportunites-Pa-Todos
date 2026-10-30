import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Server-side Claude integration. The API key never leaves the server; when
// ANTHROPIC_API_KEY is unset, every AI feature reports "not configured" and
// the UI falls back to the deterministic generators in lib/coach.ts.

export const AI_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI is not configured: set ANTHROPIC_API_KEY on the server.");
  }
}

export interface ChatTurn { role: "user" | "assistant"; content: string }

export async function complete(opts: {
  system: string;
  messages: ChatTurn[];
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<string> {
  if (!aiConfigured()) throw new AiNotConfiguredError();
  try {
    const res = await getClient().beta.messages.create({
      model: AI_MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      messages: opts.messages,
      output_config: { effort: opts.effort ?? "medium" },
      // Re-run on Anthropic's recommended model if a safety classifier declines.
      fallbacks: "default",
      betas: ["server-side-fallback-2026-07-01"],
    });
    if (res.stop_reason === "refusal") {
      return "The AI declined this request. Try rephrasing it.";
    }
    const text = res.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (res.stop_reason === "max_tokens") return `${text}\n\n[Response truncated]`;
    return text || "(No text returned.)";
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error("ANTHROPIC_API_KEY was rejected. Check the key.");
    if (err instanceof Anthropic.RateLimitError) throw new Error("AI rate limit reached. Try again in a minute.");
    if (err instanceof Anthropic.APIConnectionError) throw new Error("Could not reach the Anthropic API from the server.");
    if (err instanceof Anthropic.APIError) throw new Error(`AI request failed (${err.status ?? "error"}).`);
    throw err;
  }
}

/** Extract a JSON object from a model reply that may be wrapped in a code fence. */
export function parseJsonReply<T>(text: string): T | null {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (m ? m[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

export const GROUNDING_RULES = `Grounding rules (mandatory):
- Use ONLY the user profile, company records, job records and networking notes in the context. Do not invent companies, recruiters, job postings, booth numbers, sponsorship policies or accomplishments.
- Label every factual statement taken from the context with [Sourced] and say where it came from (e.g. "[Sourced: SHPE 2026 participation — verified]"). Label your recommendations and interpretations with [AI advice].
- If the context lacks the information, say so plainly and suggest how the user can find out (e.g. ask the recruiter, check the posting).
- Never state or imply the user is or isn't authorized to work in the U.S. beyond what their settings say. Do not equate company fit with legal eligibility.
- Keep answers concise and practical for someone walking a career fair.`;
