// Controlled vocabulary shared by profile analysis, company tagging and job
// matching. Keeping one vocabulary is what makes the compatibility score
// explainable: every point traces back to a named domain on both sides.

export type DomainKey =
  | "additive_manufacturing"
  | "lpbf"
  | "superalloys_high_temp"
  | "heat_treatment_hip"
  | "mechanical_testing"
  | "materials_characterization"
  | "ndt_metrology"
  | "am_qualification_standards"
  | "propulsion_turbomachinery"
  | "aerospace_systems"
  | "space"
  | "defense"
  | "cad_design"
  | "simulation_fea"
  | "machining_cnc"
  | "manufacturing_engineering"
  | "process_optimization"
  | "metals_processing"
  | "automotive_powertrain"
  | "energy_power"
  | "semiconductor_equipment"
  | "semiconductor_manufacturing"
  | "medical_devices"
  | "consumer_hardware"
  | "industrial_automation"
  | "heavy_equipment_rail"
  | "hvac_thermal"
  | "construction_infrastructure"
  | "software_data"
  | "pharma_consumer_manufacturing"
  | "finance_tech"
  | "technical_leadership"
  | "research_development";

export interface Domain {
  key: DomainKey;
  label: string;
  group: "Materials & AM" | "Aerospace & Defense" | "Design & Analysis" | "Manufacturing" | "Industries" | "Professional";
  keywords: string[];
}

export const DOMAINS: Domain[] = [
  { key: "additive_manufacturing", label: "Additive manufacturing", group: "Materials & AM", keywords: ["additive manufacturing", "additively manufactured", "3d print", "3d-print", "am ", " am,", "dfam", "directed energy deposition", "binder jet"] },
  { key: "lpbf", label: "Laser powder bed fusion (LPBF)", group: "Materials & AM", keywords: ["laser powder bed fusion", "lpbf", "l-pbf", "powder bed", "dmls", "slm", "eos m"] },
  { key: "superalloys_high_temp", label: "High-temperature alloys / superalloys", group: "Materials & AM", keywords: ["grx-810", "superalloy", "inconel", "in718", "in625", "ods alloy", "oxide-dispersion", "nicocr", "high-temperature", "high temperature alloy", "nickel-based"] },
  { key: "heat_treatment_hip", label: "Heat treatment & HIP", group: "Materials & AM", keywords: ["hot isostatic", "hip", "heat treatment", "heat-treat", "annealing", "solution treat"] },
  { key: "mechanical_testing", label: "Mechanical testing (tensile, creep)", group: "Materials & AM", keywords: ["tensile", "uts", "yield strength", "mechanical testing", "creep", "fatigue", "nanoindentation", "stress-strain", "elongation", "mechanical behavior", "mechanical characterization"] },
  { key: "materials_characterization", label: "Materials characterization (SEM/EBSD)", group: "Materials & AM", keywords: ["sem", "ebsd", "eds", "metallography", "microstructure", "fractography", "optical microscopy", "grain", "texture analysis", "materials science"] },
  { key: "ndt_metrology", label: "NDT, NDE & metrology", group: "Materials & AM", keywords: ["ndt", "nde", "non-destructive", "xct", "ct scan", "metrology", "cmm", "inspection"] },
  { key: "am_qualification_standards", label: "AM process qualification & standards", group: "Materials & AM", keywords: ["qualification", "iso/astm", "astm", "standards", "process validation", "certification of parts", "reproducibility", "machine-to-machine"] },
  { key: "propulsion_turbomachinery", label: "Propulsion & turbomachinery", group: "Aerospace & Defense", keywords: ["turbine", "blisk", "jet engine", "propulsion", "rocket engine", "combustor", "turbomachinery", "gas turbine", "liquid rocket"] },
  { key: "aerospace_systems", label: "Aerospace systems & components", group: "Aerospace & Defense", keywords: ["aerospace", "aircraft", "avionics", "vertical lift", "flight", "uas", "drone", "rotorcraft"] },
  { key: "space", label: "Space systems", group: "Aerospace & Defense", keywords: ["nasa", "space", "rocket", "launch vehicle", "satellite", "spacecraft"] },
  { key: "defense", label: "Defense programs", group: "Aerospace & Defense", keywords: ["defense", "dod", "army", "afrl", "military", "fort bliss", "sandia"] },
  { key: "cad_design", label: "CAD & mechanical design", group: "Design & Analysis", keywords: ["solidworks", "cswp", "nx", "fusion 360", "catia", "creo", "cad", "dfm", "dfa", "mechanical design", "prototype", "prototyped"] },
  { key: "simulation_fea", label: "Simulation & FEA", group: "Design & Analysis", keywords: ["ansys", "hyperworks", "fea", "finite element", "cfd", "abaqus", "simulation"] },
  { key: "machining_cnc", label: "CNC machining & EDM", group: "Manufacturing", keywords: ["cnc", "wire edm", "edm", "machining", "lathe", "mill"] },
  { key: "manufacturing_engineering", label: "Manufacturing engineering", group: "Manufacturing", keywords: ["manufacturing engineering", "advanced manufacturing", "production", "assembly", "manufacturing process", "manufacturing"] },
  { key: "process_optimization", label: "Process optimization & statistics", group: "Manufacturing", keywords: ["process optimization", "minitab", "doe", "design of experiments", "statistical", "six sigma", "lean", "variability", "cost reduction", "decrease"] },
  { key: "metals_processing", label: "Metals processing & steelmaking", group: "Manufacturing", keywords: ["steel", "ferroalloy", "foundry", "casting", "welding", "laser welding", "forging", "metal"] },
  { key: "automotive_powertrain", label: "Automotive & powertrain", group: "Industries", keywords: ["automotive", "vehicle", "powertrain", "engine", "ev ", "electric vehicle"] },
  { key: "energy_power", label: "Energy & power generation", group: "Industries", keywords: ["energy", "power generation", "nuclear", "grid", "wind", "gas turbine", "utility", "hydrogen"] },
  { key: "semiconductor_equipment", label: "Semiconductor equipment", group: "Industries", keywords: ["wafer fab equipment", "semiconductor equipment", "etch", "deposition", "process control", "lithography"] },
  { key: "semiconductor_manufacturing", label: "Semiconductor manufacturing", group: "Industries", keywords: ["semiconductor", "fab", "chip", "wafer", "foundry process"] },
  { key: "medical_devices", label: "Medical devices", group: "Industries", keywords: ["medical device", "prosthetic", "implant", "biomedical"] },
  { key: "consumer_hardware", label: "Consumer & computing hardware", group: "Industries", keywords: ["consumer electronics", "hardware", "device", "pc", "laptop", "data center hardware"] },
  { key: "industrial_automation", label: "Industrial automation & controls", group: "Industries", keywords: ["automation", "controls", "plc", "robotics", "autonomous", "industrial"] },
  { key: "heavy_equipment_rail", label: "Heavy equipment & rail", group: "Industries", keywords: ["heavy equipment", "rail", "locomotive", "mining equipment", "construction equipment"] },
  { key: "hvac_thermal", label: "HVAC & thermal systems", group: "Industries", keywords: ["hvac", "thermal", "heat transfer", "cooling", "cooling channels", "refrigeration"] },
  { key: "construction_infrastructure", label: "Construction & infrastructure", group: "Industries", keywords: ["construction", "infrastructure", "civil", "building", "facilities"] },
  { key: "software_data", label: "Software & data", group: "Design & Analysis", keywords: ["python", "matlab", "sql", "javascript", "react", "software", "data analysis", "slicing software", "programming"] },
  { key: "pharma_consumer_manufacturing", label: "Pharma / consumer-goods manufacturing", group: "Industries", keywords: ["pharmaceutical", "consumer goods", "packaging", "bioprocess"] },
  { key: "finance_tech", label: "Finance & business technology", group: "Industries", keywords: ["finance", "banking", "fintech"] },
  { key: "technical_leadership", label: "Technical leadership & program building", group: "Professional", keywords: ["founded", "founder", "director", "lead ", "led ", "curriculum", "chief executive", "organize", "bootcamp", "mentor", "president"] },
  { key: "research_development", label: "Research & development", group: "Professional", keywords: ["research", "r&d", "publication", "symposium", "conference", "study", "investigat"] },
];

export const DOMAIN_BY_KEY: Record<DomainKey, Domain> = Object.fromEntries(
  DOMAINS.map((d) => [d.key, d]),
) as Record<DomainKey, Domain>;

export function isDomainKey(k: string): k is DomainKey {
  return k in DOMAIN_BY_KEY;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Count keyword hits per domain in free text (resume, job description...). */
export function detectDomains(text: string): Map<DomainKey, { hits: number; matched: Set<string> }> {
  const hay = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;
  const out = new Map<DomainKey, { hits: number; matched: Set<string> }>();
  for (const d of DOMAINS) {
    for (const kw of d.keywords) {
      const k = kw.toLowerCase();
      // Short acronyms must match as whole words to avoid "hip" in "ship".
      const re = k.trim().length <= 4
        ? new RegExp(`(^|[^a-z0-9])${escapeRegex(k.trim())}([^a-z0-9]|$)`, "g")
        : new RegExp(escapeRegex(k), "g");
      const n = hay.match(re)?.length ?? 0;
      if (n > 0) {
        const cur = out.get(d.key) ?? { hits: 0, matched: new Set<string>() };
        cur.hits += n;
        cur.matched.add(kw.trim());
        out.set(d.key, cur);
      }
    }
  }
  return out;
}

export const INDUSTRY_OPTIONS = [
  "Aerospace & Defense",
  "Space",
  "Advanced Manufacturing",
  "Additive Manufacturing",
  "Materials",
  "Automotive",
  "Energy",
  "Industrial",
  "Semiconductors",
  "Medical Devices",
  "Technology",
  "Construction",
  "Consumer Goods",
  "Pharmaceuticals",
  "Financial Services",
  "Academia & Research",
] as const;
