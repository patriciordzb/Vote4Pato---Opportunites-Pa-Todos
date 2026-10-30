import dataset from "../../data/shpe2026-dataset.json";

export const EVENT = dataset.event as {
  name: string;
  dates: string;
  start: string;
  end: string;
  venue: string;
  career_fair: { day: string; hours: string }[];
  career_fair_verification: "verified" | "partially_verified" | "unverified";
  career_fair_source: string;
  scale_note: string;
  sources: string[];
};

/** Where we are relative to the convention, in the convention's time zone (Indianapolis, ET). */
export function eventPhase(now = new Date()) {
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/Indiana/Indianapolis" });
  const fair = EVENT.career_fair.find((f) => f.day === today);
  if (today < EVENT.start) {
    const days = Math.ceil((new Date(`${EVENT.start}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
    return { phase: "before" as const, label: `Convention starts in ${days} day${days === 1 ? "" : "s"}`, today };
  }
  if (today > EVENT.end) return { phase: "after" as const, label: "Convention is over. Follow-up season.", today };
  return {
    phase: "during" as const,
    label: fair ? `Career Fair today · ${fair.hours}` : "Convention in progress",
    today,
  };
}
