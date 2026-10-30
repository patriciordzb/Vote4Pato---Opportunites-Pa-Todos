import type { ChatTurn } from "./ai";
import type { Prep } from "./coach";
import type { Company } from "./types";

// Scripted mock-recruiter used when no AI key is configured. It asks the
// prep questions in order and scores answers with transparent heuristics.

const TECH_TERMS = /(lpbf|powder bed|hip|uts|tensile|ebsd|sem|superalloy|grx-810|inconel|qualification|anisotrop|microstructure|build angle|metrology|nde|dfm|cad|solidworks|ansys|manufactur|process|test)/gi;

export function scriptedMockReply(company: Company, prep: Prep, history: ChatTurn[]): string {
  const userTurns = history.filter((m) => m.role === "user");
  const questions = [
    `Hi, thanks for stopping by the ${company.name} booth! Tell me a bit about yourself.`,
    prep.hardQuestions[2].q,
    `What interests you about ${company.name} specifically?`,
    "Tell me about a challenge you ran into on a project and how you handled it.",
    prep.hardQuestions[5].q,
    "Do you have any questions for me?",
  ];
  const last = userTurns[userTurns.length - 1]?.content ?? "";
  if (/feedback|how did i do|end/i.test(last) || userTurns.length >= questions.length) {
    return feedback(company, userTurns.map((u) => u.content));
  }
  const tip = userTurns.length ? quickTip(company, last) : "";
  return `${tip ? `_${tip}_\n\n` : ""}${questions[userTurns.length]}`;
}

function quickTip(company: Company, answer: string) {
  const words = answer.trim().split(/\s+/).length;
  if (words < 25) return "Coach note: that was short. Add one specific result or number.";
  if (words > 170) return "Coach note: that ran long. Aim for 30–60 seconds (about 80–150 words).";
  if (!/\d/.test(answer)) return "Coach note: a metric (MPa, %, $, team size) would make that more credible.";
  if (!answer.toLowerCase().includes(company.name.toLowerCase().split(" ")[0])) return `Coach note: tie it back to ${company.name}.`;
  return "Coach note: good, specific answer.";
}

function feedback(company: Company, answers: string[]) {
  const all = answers.join(" ");
  const words = answers.map((a) => a.trim().split(/\s+/).length);
  const avg = words.reduce((a, b) => a + b, 0) / Math.max(1, words.length);
  const metrics = (all.match(/\d[\d.,]*\s*(mpa|%|\$|k|students|parts|°|degrees)?/gi) ?? []).length;
  const tech = new Set((all.match(TECH_TERMS) ?? []).map((t) => t.toLowerCase())).size;
  const mentionsCompany = answers.filter((a) => a.toLowerCase().includes(company.name.toLowerCase().split(" ")[0])).length;
  const hedges = (all.match(/\b(um|uh|like|i guess|kind of|sort of|maybe)\b/gi) ?? []).length;
  const asked = answers.some((a) => a.includes("?"));
  const score = (v: number) => Math.max(1, Math.min(5, Math.round(v)));
  const rows = [
    ["Clarity", score(avg >= 40 && avg <= 160 ? 4.5 : avg < 40 ? 2.5 : 3), avg < 40 ? "Answers were brief. Use a situation → action → result structure." : avg > 160 ? "Trim answers to about 60 seconds." : "Good length and structure."],
    ["Confidence", score(5 - hedges * 0.7), hedges ? `Found ${hedges} filler/hedge word(s). Replace them with direct statements.` : "Direct language, no hedging."],
    ["Technical depth", score(1 + tech * 0.5), tech >= 5 ? "Strong technical vocabulary grounded in your research." : "Name the methods (LPBF, HIP, EBSD, tensile testing) and the results."],
    ["Relevance", score(1 + mentionsCompany * 1.2), mentionsCompany ? `You tied answers to ${company.name} ${mentionsCompany} time(s).` : `Connect your experience to ${company.name}'s work explicitly.`],
    ["Professional communication", score(3 + (metrics ? 1 : 0) + (asked ? 1 : 0)), metrics ? `Used ${metrics} concrete number(s).` : "Add quantified results."],
    ["Follow-up questions", asked ? 5 : 2, asked ? "You asked the recruiter questions. Good." : "Ask 1–2 specific questions before you leave the booth."],
  ] as const;
  return `### Mock interview feedback (rule-based)\n\n| Area | Score | Feedback |\n|---|---|---|\n${rows.map(([a, s, f]) => `| ${a} | ${s}/5 | ${f} |`).join("\n")}\n\n_Scored with transparent heuristics (length, metrics, technical terms, company references, filler words). Configure ANTHROPIC_API_KEY for a realistic AI recruiter and richer feedback._\n\nType anything to start a new round.`;
}
