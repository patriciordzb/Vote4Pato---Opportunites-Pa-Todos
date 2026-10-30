import type { Assessment } from "./scoring";
import type { Company, Job, Preferences, ProfileData, Recruiter } from "./types";
import type { DomainKey } from "./taxonomy";
import { profileToText } from "./intel";

// Deterministic conversation-prep generator. Everything here is assembled
// from the user's approved profile and the company record; nothing is invented.
// The AI layer (lib/ai.ts) can rewrite these, but this is always available.

interface Anchor { requires: RegExp; text: string; short: string }

/** Evidence sentences, each enabled only while the profile still contains its facts. */
const ANCHORS: Partial<Record<DomainKey, Anchor[]>> = {
  lpbf: [{ requires: /GRX-810/i, text: "I study how laser powder bed fusion build angle (45° to 90°) and machine affect the microstructure and tensile properties of NASA's GRX-810 superalloy after HIP", short: "LPBF build-angle research on NASA's GRX-810" }],
  additive_manufacturing: [{ requires: /50\+ additively manufactured GRX-810/i, text: "I've characterized 50+ additively manufactured GRX-810 parts with NASA Marshall and Glenn", short: "metal AM characterization with NASA" }],
  superalloys_high_temp: [{ requires: /GRX-810/i, text: "my research is on GRX-810, a NiCoCr oxide-dispersion-strengthened superalloy built for temperatures up to about 1,300 °C", short: "high-temperature ODS superalloy research" }],
  heat_treatment_hip: [{ requires: /1163/, text: "I evaluate how properties hold up after HIP (1163 °C, 100 MPa), where orientation effects still appear", short: "post-HIP property evaluation" }],
  mechanical_testing: [{ requires: /884\.6/, text: "in tensile testing, mean UTS on one machine dropped from 884.6 MPa at 45° to 793.8 MPa at 90°, about 10% lower", short: "tensile testing across build angles" }],
  materials_characterization: [{ requires: /fractography/i, text: "I use metallography, EBSD and SEM fractography to connect microstructure to mechanical behavior", short: "SEM/EBSD characterization" }],
  am_qualification_standards: [
    { requires: /M280-M1/, text: "my study compares five EOS L-PBF systems to quantify machine-to-machine variability, which is the evidence process qualification needs", short: "machine-to-machine qualification data" },
    { requires: /Future Vertical Lift|FVL/i, text: "on the Future Vertical Lift project I worked with Bell Flight, Bessel and AFRL on gaps in ISO/ASTM/NASA AM standards", short: "AM standards work with Bell Flight & AFRL" },
  ],
  ndt_metrology: [{ requires: /blisk/i, text: "I carried an AM Inconel 718 blisk design through DFM/DFA review, process validation, NDE and metrology", short: "blisk NDE & metrology" }],
  propulsion_turbomachinery: [
    { requires: /blisk/i, text: "I designed an additively manufactured Inconel 718 turbine blisk", short: "AM Inconel 718 blisk design" },
    { requires: /rocket engine/i, text: "I lead a student team building a 3D-printed liquid rocket engine", short: "3D-printed liquid rocket engine team" },
  ],
  manufacturing_engineering: [{ requires: /Vinton/i, text: "at Vinton Steel I designed and prototyped a ferroalloy weigh-dumping system expected to save about $250,000", short: "$250K manufacturing improvement at Vinton Steel" }],
  metals_processing: [{ requires: /Vinton/i, text: "I've worked inside a steel melt shop, solving an out-of-spec chemistry problem with new hardware", short: "steel-plant hardware design" }],
  process_optimization: [{ requires: /250,000|\$250/i, text: "my Vinton Steel design targets about $250,000 in ferroalloy savings by preventing re-additions", short: "cost-driven process improvement" }],
  cad_design: [{ requires: /CSWP/, text: "I'm a Certified SolidWorks Professional", short: "CSWP-certified mechanical design" }],
  simulation_fea: [{ requires: /ANSYS|HyperWorks/i, text: "I use ANSYS and HyperWorks for analysis", short: "ANSYS/HyperWorks analysis" }],
  machining_cnc: [{ requires: /CNC|EDM/i, text: "I have hands-on CNC and wire EDM experience", short: "CNC & wire EDM" }],
  technical_leadership: [
    { requires: /ASCENT/i, text: "I founded ASCENT, a student R&D lab with $10,000 in Sandia-sourced funding, and lead 24 engineers across four hardware teams", short: "founder of a 24-person R&D lab" },
    { requires: /Director of Academics/i, text: "as SHPE Director of Academics I run technical workshops reaching 400+ students", short: "SHPE Director of Academics" },
  ],
  defense: [{ requires: /Fort Bliss/i, text: "I'm developing a five-level advanced manufacturing curriculum for 200+ U.S. Army personnel at Fort Bliss", short: "AM curriculum for the U.S. Army" }],
  space: [{ requires: /NASA/i, text: "I collaborate with NASA Marshall and Glenn on an alloy developed for extreme aerospace environments", short: "NASA collaboration" }],
  aerospace_systems: [{ requires: /drone|Vertical Lift/i, text: "I've worked on Future Vertical Lift AM standards and lead an autonomous drone team", short: "vertical-lift & UAS work" }],
  research_development: [{ requires: /SFF/i, text: "I presented four papers at the 2026 Solid Freeform Fabrication Symposium", short: "4 SFF 2026 presentations" }],
  hvac_thermal: [{ requires: /cooling channels/i, text: "one of my SFF papers covers laser welding of AM Inconel 718 double-walled cooling channels", short: "AM cooling-channel research" }],
  industrial_automation: [{ requires: /autonomous/i, text: "my lab is building an autonomous wildfire and flood response drone system", short: "autonomous systems team" }],
  medical_devices: [{ requires: /prosthetic/i, text: "one of my lab's teams develops open-source prosthetic limbs", short: "prosthetics team" }],
  software_data: [{ requires: /slicing software/i, text: "I analyze test data in Python, MATLAB and Minitab, and my lab is writing custom slicing software", short: "Python/MATLAB data analysis" }],
  automotive_powertrain: [{ requires: /rocket engine/i, text: "I lead a student propulsion hardware team", short: "propulsion & production hardware" }],
  energy_power: [{ requires: /GRX-810/i, text: "high-temperature alloys like GRX-810 matter for turbine efficiency in power generation as well as aerospace", short: "high-temp alloys for turbines" }],
  semiconductor_equipment: [{ requires: /EBSD/, text: "I use precision characterization tools such as SEM and EBSD", short: "precision characterization" }],
  semiconductor_manufacturing: [{ requires: /M280-M1/, text: "much of my research is quantifying process variability across machines", short: "process-variability analysis" }],
};

function anchorsFor(domains: DomainKey[], profileText: string, limit: number): Anchor[] {
  const out: Anchor[] = [];
  const seen = new Set<string>();
  for (const d of domains) {
    for (const a of ANCHORS[d] ?? []) {
      if (a.requires.test(profileText) && !seen.has(a.text)) {
        out.push(a);
        seen.add(a.text);
        break;
      }
    }
    if (out.length >= limit) break;
  }
  return out;
}

function firstName(full: string) {
  return full.split(/\s+/)[0];
}

function degreeLine(p: ProfileData) {
  const e = p.education[0];
  if (!e) return "an engineering student";
  const field = e.degree.replace(/^B\.?S\.?\s*/i, "");
  return `${/^[aeiou]/i.test(field) ? "an" : "a"} ${field} student at ${e.school.replace(/^The /, "")}${e.expectedGraduation ? `, graduating ${e.expectedGraduation}` : ""}`;
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface Prep {
  why: string[];
  pitch15: string;
  pitch30: string;
  pitch60: string;
  talkingPoints: { topic: string; detail: string }[];
  starters: string[];
  questions: string[];
  hardQuestions: { q: string; a: string }[];
}

export function buildPrep(company: Company, a: Assessment, p: ProfileData, prefs: Preferences, jobs: Job[]): Prep {
  const text = profileToText(p);
  const domains = a.matchedDomains.map((m) => m.key);
  const anchors = anchorsFor(domains, text, 4);
  const leadership = anchorsFor(["technical_leadership"], text, 1);
  const name = p.fullName;
  const ctxFor = (k: DomainKey) => company.tech_tags[k]?.context;

  const why: string[] = a.matchedDomains.slice(0, 4).map((m) => {
    const anchor = anchorsFor([m.key], text, 1)[0];
    return anchor
      ? `${cap(anchor.text)}. That connects to ${company.name}'s work on ${m.context}.`
      : `Your ${m.evidence.replace(/^[^:]+:\s*/, "")} relates to ${company.name}'s work on ${m.context}.`;
  });
  if (!why.length) {
    why.push(`${company.name}'s documented engineering areas don't overlap much with your profile. Present your general strengths: research rigor, hands-on manufacturing, and leadership.`);
  }

  const topArea = a.matchedDomains[0]?.context ?? company.engineering_areas[0] ?? "engineering";
  const pitch15 = `Hi, I'm ${firstName(name)}, ${degreeLine(p).replace(/, graduating.*$/, "")}${anchors[0] ? `, and my focus is ${anchors[0].short}` : ""}. I'd love to hear how that could fit ${company.name}'s work on ${topArea}.`;
  const pitch30 = [
    `Hi, I'm ${name}, ${degreeLine(p)}.`,
    anchors[0] ? `${cap(anchors[0].text)}.` : "",
    anchors[1] ? `${cap(anchors[1].text)}.` : "",
    `I'm interested in ${company.name} because of your work on ${topArea}, and I'd like to know where someone with my background could contribute.`,
  ].filter(Boolean).join(" ");
  const pitch60 = [
    `Hi, I'm ${name}, ${degreeLine(p)}.`,
    ...anchors.slice(0, 3).map((x) => `${cap(x.text)}.`),
    leadership[0] && !anchors.includes(leadership[0]) ? `Outside the lab, ${leadership[0].text}.` : "",
    `What draws me to ${company.name} is ${a.matchedDomains.slice(0, 2).map((m) => m.context).join(" and ") || topArea}.`,
    `I'm looking for ${prefs.employmentTypes.includes("internship") ? "internship or co-op" : "full-time"} opportunities where I can apply this. Which teams would you suggest I look at?`,
  ].filter(Boolean).join(" ");

  const TOPICS: Partial<Record<DomainKey, (ctx: string) => { topic: string; detail: string }>> = {
    lpbf: (ctx) => ({ topic: "Build-orientation effects in LPBF", detail: `Your data shows lower UTS at 90° than 45° on every machine tested so far. Ask how ${company.name} accounts for orientation-dependent properties in ${ctx}.` }),
    am_qualification_standards: (ctx) => ({ topic: "AM process qualification across machines", detail: `You quantified machine-to-machine scatter across EOS M280/M290/M400 systems. Ask how ${company.name} qualifies parts when production moves between machines (${ctx}).` }),
    superalloys_high_temp: (ctx) => ({ topic: "High-temperature materials", detail: `GRX-810's ODS strengthening and creep advantage over IN718/IN625. Ask what temperature limits drive material choices in ${ctx}.` }),
    heat_treatment_hip: () => ({ topic: "HIP and post-processing", detail: "Anisotropy can persist after HIP. Ask how their post-processing specs handle orientation and porosity closure." }),
    mechanical_testing: () => ({ topic: "Mechanical characterization", detail: "Tensile testing with miniature specimens, scatter at 75° and 90°, and nanoindentation creep work. Ask what test methods their materials labs rely on." }),
    materials_characterization: () => ({ topic: "Microstructure–property links", detail: "EBSD showed columnar grains along Z, and the texture–strength link is still being confirmed. Ask how they correlate microstructure with performance." }),
    propulsion_turbomachinery: (ctx) => ({ topic: "Propulsion hardware", detail: `Your AM Inconel 718 blisk and the 3D-printed rocket engine team. Connect them to ${ctx}.` }),
    manufacturing_engineering: (ctx) => ({ topic: "Manufacturing problem-solving", detail: `The Vinton Steel weigh-dumping system ($250K expected savings) is an example of production-floor engineering. Relate it to ${ctx}.` }),
    ndt_metrology: () => ({ topic: "Inspection & NDE of AM parts", detail: "Blisk NDE/metrology and XCT experience. Ask how they inspect internal features of AM parts." }),
    process_optimization: () => ({ topic: "Process variability & statistics", detail: "Machine × angle effects and replicate scatter. Ask how they use statistical process control." }),
    semiconductor_equipment: (ctx) => ({ topic: "Precision measurement", detail: `Your SEM/EBSD/XCT experience relates to ${ctx}. Ask which mechanical or materials problems their equipment engineers solve.` }),
    energy_power: (ctx) => ({ topic: "Materials for power generation", detail: `High-temperature alloys in ${ctx}: ask about hot-gas-path materials and AM repairs.` }),
    automotive_powertrain: (ctx) => ({ topic: "Powertrain components", detail: `Ask where AM and materials testing fit in ${ctx}.` }),
    technical_leadership: () => ({ topic: "Leadership", detail: "Founding ASCENT (24 students, Sandia-sourced funding) shows you can run hardware programs." }),
  };
  const talkingPoints = a.matchedDomains
    .map((m) => TOPICS[m.key]?.(m.context))
    .filter((t): t is { topic: string; detail: string } => !!t)
    .slice(0, 6);

  const starters = [
    `I saw that ${company.name} works on ${topArea}. What problems is your engineering team focused on this year?`,
    anchors[0] ? `I'm presenting research where ${anchors[0].text}. Does that overlap with anything your teams are working on?` : `What does a typical project look like for early-career engineers at ${company.name}?`,
    `Which of your groups (${company.engineering_areas.slice(0, 3).join(", ") || "engineering"}) is hiring interns or new grads from this convention?`,
  ];

  const questions = [
    `Which engineering teams at ${company.name} are recruiting at SHPE this year, and for which roles?`,
    ctxFor("additive_manufacturing") ? `How is additive manufacturing used in production at ${company.name}, and who owns AM qualification?` : `What technical skills set your strongest interns apart?`,
    ctxFor("superalloys_high_temp") || ctxFor("materials_characterization") ? `What does the materials & process engineering group work on, and do interns get lab time?` : `What would my first 90 days look like on your team?`,
    `What training or rotation programs do early-career engineers go through?`,
    `Do you have research collaborations or co-op roles connected to universities?`,
    `Are there roles at ${company.name} open to candidates with my work-authorization situation, including teams outside export-controlled programs or international sites?`,
    jobs[0] ? `I'm interested in "${jobs[0].title}". What do strong applicants for that role usually have in common?` : `Which open postings would you recommend I apply to after today?`,
    `What's the best way to stay in touch after the convention: apply online first, or connect on LinkedIn?`,
  ];

  const workAuthAnswer = (() => {
    switch (prefs.citizenship) {
      case "us_citizen": return "Yes, I'm a U.S. citizen.";
      case "permanent_resident": return "Yes, I'm a U.S. permanent resident, so I'm authorized to work and I qualify as a U.S. person for export-control purposes.";
      default: {
        const auth = prefs.workAuthorization ? ` My current status is ${prefs.workAuthorization}.` : " [State your exact current status here. Set it on the Profile page so this answer fills in.]";
        const spons = prefs.sponsorship === "needs_now" || prefs.sponsorship === "needs_future"
          ? " I will need sponsorship"
          : prefs.sponsorship === "not_needed" ? " I won't need sponsorship" : " [Say whether you will need sponsorship]";
        return `I'm not a U.S. citizen.${auth}${spons}. I'd rather be upfront so we can focus on roles where that works. Are there teams at ${company.name} that can consider candidates in my situation?`;
      }
    }
  })();

  const research = p.research[0];
  const hardQuestions = [
    { q: "Tell me about yourself.", a: pitch60 },
    { q: `Why are you interested in ${company.name}?`, a: why.slice(0, 2).join(" ") + ` I want to work where my research and manufacturing experience apply directly. For me that's ${topArea}.` },
    research
      ? { q: "Explain your research.", a: `I'm asking: ${research.question ?? research.title} We built specimens on several EOS laser powder bed fusion machines at angles from 45° to 90°, HIPed them, and ran room-temperature tensile tests plus microscopy and EBSD. So far, mean UTS is lower at 90° than at 45° on every machine tested. On one machine it went from 884.6 to 793.8 MPa. There's also machine-to-machine scatter. The goal is evidence for qualifying GRX-810 across machines. The mechanism is still open, and I'm careful not to overclaim.` }
      : { q: "Explain your research.", a: "Add your research on the Profile page to generate this answer." },
    { q: "What challenges have you encountered?", a: "In my GRX-810 work, yield strength scatter at 75° and 90° made it hard to separate machine effects from angle effects. I learned to report results as preliminary, add replicates, and plan statistical tests for the interaction instead of over-reading small differences. At Vinton Steel the challenge was designing hardware that works in a melt shop, not just in CAD, so I prototyped early and worked directly with operators." },
    { q: "Why should we hire you?", a: `I bring hands-on metal AM research with NASA, production experience from a steel plant, and proof that I can lead a team${anchors[0] ? `. In short: ${anchors.slice(0, 3).map((x) => x.short).join("; ")}` : ""}. I'm used to rigorous testing and to delivering hardware that saves money.` },
    { q: "Are you authorized to work in the United States?", a: workAuthAnswer },
    { q: "What is your experience outside the classroom?", a: "I was a mechanical engineering intern at Vinton Steel, where I designed a weigh-dumping system. I'm a research assistant at the W.M. Keck Center, I founded ASCENT (24 students, four hardware teams), and I'm SHPE Director of Academics, running workshops for 400+ students." },
  ];

  return { why, pitch15, pitch30, pitch60, talkingPoints, starters, questions, hardQuestions };
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export const MESSAGE_KINDS = {
  connection: "LinkedIn connection request",
  intro: "Personalized introduction",
  post_convention: "Post-convention follow-up",
  opportunity: "Ask about engineering opportunities",
  info_interview: "Informational interview request",
  thank_you: "Thank-you message",
  application_followup: "Application follow-up",
} as const;
export type MessageKind = keyof typeof MESSAGE_KINDS;

export interface MessageContext {
  kind: MessageKind;
  profile: ProfileData;
  company: Company;
  recruiter?: Pick<Recruiter, "full_name" | "title"> | null;
  job?: Pick<Job, "title" | "requisition_id"> | null;
  conversationNotes?: string;
  matchedContext?: string;
  anchor?: string;
}

export function buildMessage(c: MessageContext): string {
  const me = c.profile.fullName;
  const myFirst = firstName(me);
  const greet = c.recruiter ? `Hi ${firstName(c.recruiter.full_name)},` : "Hello,";
  const text = profileToText(c.profile);
  const anchor = c.anchor ?? anchorsFor(["lpbf", "superalloys_high_temp", "manufacturing_engineering"], text, 1)[0]?.text ?? "I work on engineering research and hardware projects";
  const area = c.matchedContext ?? c.company.engineering_areas[0] ?? "engineering";
  const notes = c.conversationNotes?.trim();
  const jobRef = c.job ? `the ${c.job.title}${c.job.requisition_id ? ` (${c.job.requisition_id})` : ""} role` : "engineering internship and co-op roles";

  switch (c.kind) {
    case "connection": {
      const msg = `${greet} I'm ${myFirst}, an aerospace & mechanical engineering student at UTEP researching LPBF of NASA's GRX-810 alloy. I'm interested in ${c.company.name}'s work on ${area} and would value connecting${notes ? " after our chat at SHPE" : " around SHPE 2026"}.`;
      return msg.length <= 300 ? msg : `${greet} I'm ${myFirst}, a UTEP aerospace/mechanical engineering student in metal AM research. I'm interested in ${c.company.name}'s work on ${area} and would value connecting.`.slice(0, 300);
    }
    case "intro":
      return `${greet}\n\nI'm ${me}, an Aerospace and Mechanical Engineering student at UTEP. ${cap(anchor)}.\n\nI'm reaching out because ${c.company.name}'s work on ${area} lines up closely with what I want to do. I'd appreciate any guidance on ${jobRef}, or on which team I should get to know.\n\nThank you for your time,\n${me}`;
    case "post_convention":
      return `${greet}\n\nThank you for speaking with me at the SHPE National Convention in Indianapolis.${notes ? ` I enjoyed our conversation about ${notes}.` : ""}\n\nAs I mentioned, ${anchor}. After our talk I'm even more interested in ${c.company.name}'s work on ${area}, especially ${jobRef}.\n\nI'll submit my application online and would be glad to send my resume or research poster if helpful. Is there anything else you'd recommend I do?\n\nBest regards,\n${me}`;
    case "opportunity":
      return `${greet}\n\nI'm ${me}, an engineering student at UTEP focused on metal additive manufacturing and materials testing. ${cap(anchor)}.\n\nCould you point me to openings for ${jobRef} at ${c.company.name}, especially on teams working on ${area}? I'm also glad to share my work-authorization details so we can focus on roles that fit.\n\nThank you,\n${me}`;
    case "info_interview":
      return `${greet}\n\nI'm ${me}, a UTEP engineering student researching laser powder bed fusion of high-temperature alloys with NASA. I'd be grateful for 15–20 minutes to learn about your path at ${c.company.name} and how your team approaches ${area}.\n\nI'm flexible on timing and happy to work around your schedule.\n\nThank you,\n${me}`;
    case "thank_you":
      return `${greet}\n\nThank you for taking the time to talk with me${notes ? ` about ${notes}` : ""}. Your insight into ${c.company.name}'s work on ${area} was very helpful, and it confirmed my interest in ${jobRef}.\n\nI appreciate your help and look forward to staying in touch.\n\nBest,\n${me}`;
    case "application_followup":
      return `${greet}\n\nI recently applied to ${jobRef} at ${c.company.name} and wanted to follow up briefly. ${cap(anchor)}, and I believe that experience fits the team's work on ${area}.\n\nIf there's anything else I can provide, such as my resume, research poster or references, I'd be glad to send it.\n\nThank you for your consideration,\n${me}`;
  }
}

export function linkedinPeopleSearch(company: string, role = "university recruiter") {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${role} ${company}`)}`;
}

export function linkedinCompanySearch(company: string) {
  return `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(company)}`;
}
