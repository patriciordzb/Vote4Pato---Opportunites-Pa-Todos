import "server-only";
import { detectDomains, DOMAIN_BY_KEY } from "./taxonomy";
import { aiConfigured, complete, parseJsonReply } from "./ai";
import type { ProfileData } from "./types";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_KINDS = ["resume", "linkedin_pdf", "poster", "portfolio", "publication", "other"] as const;

export function isPdf(bytes: Uint8Array) {
  // %PDF- magic header; MIME type from the browser is not trusted.
  return bytes.length > 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  return text.replace(/\u0000/g, "").slice(0, 200_000);
}

const NAMED_SKILLS = [
  "SolidWorks", "Siemens NX", "NX", "CATIA", "Creo", "Fusion 360", "AutoCAD", "Inventor", "ANSYS", "Abaqus", "HyperWorks", "COMSOL",
  "STAR-CCM+", "Fluent", "MATLAB", "Simulink", "Python", "C++", "SQL", "JavaScript", "React", "LabVIEW", "Minitab", "JMP", "R",
  "SEM", "EDS", "EBSD", "TEM", "XRD", "XCT", "CT scanning", "Metallography", "Nanoindentation", "DSC", "Instron", "Tensile testing",
  "Fatigue testing", "Creep testing", "NDT", "Ultrasonic testing", "CMM", "GD&T", "DFM", "DFA", "FMEA", "Six Sigma", "Lean", "SPC", "DOE",
  "CNC", "Wire EDM", "Welding", "LPBF", "DED", "Binder jetting", "Materialise Magics", "Netfabb", "PLC", "Arduino", "ROS",
];

export interface DocumentAnalysis {
  method: "rule_based" | "ai";
  domains: { key: string; label: string; hits: number; matched: string[] }[];
  suggestions: {
    skills: string[];
    publications: string[];
    experience: { org: string; role: string; bullets: string[] }[];
    summary?: string;
  };
  notes: string[];
}

function wordRe(s: string) {
  const esc = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9+])${esc}([^A-Za-z0-9+]|$)`, s.length <= 3 ? "" : "i");
}

export async function analyzeDocument(text: string, kind: string, profile: ProfileData): Promise<DocumentAnalysis> {
  const domains = [...detectDomains(text).entries()]
    .map(([key, v]) => ({ key, label: DOMAIN_BY_KEY[key].label, hits: v.hits, matched: [...v.matched] }))
    .sort((a, b) => b.hits - a.hits);

  const have = new Set(profile.skillGroups.flatMap((g) => g.items).join(" | ").toLowerCase().split(/[|,()]/).map((s) => s.trim()));
  const profileSkillText = profile.skillGroups.flatMap((g) => g.items).join(" ").toLowerCase();
  const skills = NAMED_SKILLS.filter((s) => wordRe(s).test(text) && !profileSkillText.includes(s.toLowerCase()) && !have.has(s.toLowerCase()));

  const analysis: DocumentAnalysis = {
    method: "rule_based",
    domains,
    suggestions: { skills, publications: [], experience: [] },
    notes: ["Rule-based extraction: detected skills and engineering domains. Experience and publications need AI extraction or manual entry."],
  };

  if (!aiConfigured() || text.trim().length < 50) return analysis;

  try {
    const reply = await complete({
      effort: "low",
      maxTokens: 6000,
      system: "You extract structured professional data from a document a user uploaded about themselves (resume, LinkedIn profile PDF, research poster or portfolio). Extract only what the document states. Never invent or embellish. Output JSON only.",
      messages: [{
        role: "user",
        content: `Document type: ${kind}\n\nCurrent profile (do not repeat items already present):\n${JSON.stringify({ skills: profile.skillGroups, publications: profile.publications.map((p) => p.title), experience: profile.experience.map((e) => `${e.role} @ ${e.org}`) })}\n\nDocument text:\n"""\n${text.slice(0, 60000)}\n"""\n\nReturn JSON: {"skills": string[] (new tools/techniques only), "publications": string[] (new titles only), "experience": [{"org": string, "role": string, "bullets": string[]}] (new roles only), "summary": string (2-3 sentence professional summary grounded in the document, or "")}`,
      }],
    });
    const parsed = parseJsonReply<{ skills?: string[]; publications?: string[]; experience?: { org: string; role: string; bullets: string[] }[]; summary?: string }>(reply);
    if (parsed) {
      analysis.method = "ai";
      analysis.suggestions = {
        skills: [...new Set([...(parsed.skills ?? []), ...skills])].slice(0, 40),
        publications: (parsed.publications ?? []).slice(0, 30),
        experience: (parsed.experience ?? []).filter((e) => e.org && e.role).slice(0, 15),
        summary: parsed.summary || undefined,
      };
      analysis.notes = ["AI extraction. Review each item before approving; nothing is added to your profile until you approve it."];
    }
  } catch (e) {
    analysis.notes.push(`AI extraction failed: ${e instanceof Error ? e.message : "unknown error"}. Showing rule-based results.`);
  }
  return analysis;
}
