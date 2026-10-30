import type { DomainKey } from "./taxonomy";

export type Verification = "verified" | "partially_verified" | "unverified" | "ai_analysis";

export interface Education { school: string; degree: string; minor?: string; expectedGraduation?: string; honors?: string[] }
export interface Experience { org: string; role: string; location?: string; start?: string; end?: string; bullets: string[] }
export interface Research { title: string; org?: string; question?: string; methods: string[]; keyFindings: string[]; nextSteps?: string[]; collaborators?: string[] }
export interface Project { name: string; bullets: string[] }
export interface Publication { title: string; venue?: string; role?: string }
export interface Leadership { org: string; role: string; bullets: string[] }
export interface SkillGroup { name: string; items: string[] }

export interface ProfileData {
  fullName: string;
  headline?: string;
  location?: string;
  linkedinUrl?: string;
  email?: string;
  phone?: string;
  summary?: string;
  education: Education[];
  experience: Experience[];
  research: Research[];
  projects: Project[];
  publications: Publication[];
  leadership: Leadership[];
  skillGroups: SkillGroup[];
  certifications: string[];
  affiliations: string[];
}

export type Citizenship = "us_citizen" | "permanent_resident" | "non_us_citizen" | "prefer_not";
export type TriState = "yes" | "no" | "unknown";
export type Sponsorship = "needs_now" | "needs_future" | "not_needed" | "unknown";

export interface Preferences {
  citizenship: Citizenship;
  usPerson: TriState;
  workAuthorization: string;
  sponsorship: Sponsorship;
  clearance: TriState;
  degreeLevel: "bachelors" | "masters" | "phd";
  graduation: string;
  locations: string[];
  openToRelocate: boolean;
  employmentTypes: string[];
  industries: string[];
  goals: string;
}

export interface Profile {
  userId: string;
  data: ProfileData;
  preferences: Preferences;
  version: number;
  updatedAt: string;
}

export interface TechTag { weight: number; context: string }

export interface Participation {
  id: string;
  company_id: string;
  event_year: number;
  role: string;
  tier: string | null;
  booth_number: string | null;
  booth_location: string | null;
  activities: string[];
  verification: Exclude<Verification, "ai_analysis">;
  evidence: string;
  verified_at: string;
  source_url: string | null;
  source_title: string | null;
  source_type: string | null;
  access_note: string | null;
}

export interface Company {
  id: string;
  slug: string;
  name: string;
  industry: string;
  industries: string[];
  headquarters: string | null;
  website: string | null;
  domain: string | null;
  careers_url: string | null;
  linkedin_url: string | null;
  description: string | null;
  size: string | null;
  presence: string | null;
  products: string[];
  tech_tags: Partial<Record<DomainKey, TechTag>>;
  engineering_areas: string[];
  recent_developments: { text: string; date?: string; url?: string }[];
  technical_challenges: string[];
  eligibility_notes: string | null;
  profile_verification: Verification;
  last_verified_at: string | null;
  created_by: string;
}

export interface JobEligibility {
  citizenship_required: boolean | null;
  us_person_required: boolean | null;
  clearance_required: boolean | null;
  sponsorship: "offered" | "not_offered" | "unknown";
  note: string | null;
  evidence: string | null;
}

export interface Job {
  id: string;
  company_id: string;
  company_name?: string;
  company_slug?: string;
  title: string;
  requisition_id: string | null;
  location: string | null;
  employment_type: string;
  description: string | null;
  qualifications: string[];
  skills: string[];
  salary: string | null;
  deadline: string | null;
  posted_at: string | null;
  apply_url: string | null;
  listing_status: "open" | "closed" | "unknown";
  verification: Exclude<Verification, "ai_analysis">;
  last_checked_at: string | null;
  created_by: string;
  source_url: string | null;
  eligibility: JobEligibility | null;
}

export interface Recruiter {
  id: string;
  company_id: string;
  company_name?: string;
  company_slug?: string;
  full_name: string;
  title: string | null;
  linkedin_url: string | null;
  specialization: string | null;
  engineering_focus: string | null;
  background: string | null;
  attendance_status: "confirmed" | "potential" | "unverified";
  created_by: string;
  evidence: { kind: string; evidence: string; source_url: string | null }[];
  contact?: RecruiterContact | null;
}

export const CRM_STATUSES = [
  "none", "want_to_meet", "high_priority", "visited_booth", "met_recruiter", "connected_linkedin",
  "applied", "follow_up_needed", "interview_scheduled", "offer_received",
] as const;
export type CrmStatus = (typeof CRM_STATUSES)[number];
export const CRM_LABEL: Record<CrmStatus, string> = {
  none: "Not tracked",
  want_to_meet: "Want to Meet",
  high_priority: "High Priority",
  visited_booth: "Visited Booth",
  met_recruiter: "Met Recruiter",
  connected_linkedin: "Connected on LinkedIn",
  applied: "Applied",
  follow_up_needed: "Follow-Up Needed",
  interview_scheduled: "Interview Scheduled",
  offer_received: "Offer Received",
};

export interface CompanyTracking {
  company_id: string;
  saved: boolean;
  status: CrmStatus;
  visit_order: number | null;
  visited_at: string | null;
  mutual_connections: string | null;
  notes: string | null;
}

export interface RecruiterContact {
  recruiter_id: string;
  saved: boolean;
  status: CrmStatus;
  contact_email: string | null;
  contact_phone: string | null;
  mutual_connections: string | null;
  notes: string | null;
}

export interface Interaction {
  id: string;
  company_id: string | null;
  company_name?: string | null;
  company_slug?: string | null;
  recruiter_id: string | null;
  recruiter_name?: string | null;
  kind: string;
  occurred_at: string;
  summary: string;
  opportunities_discussed: string | null;
  impressions: string | null;
}

export interface Task {
  id: string;
  company_id: string | null;
  company_name?: string | null;
  company_slug?: string | null;
  recruiter_id: string | null;
  application_id: string | null;
  title: string;
  due_at: string | null;
  done: boolean;
}

export const APPLICATION_STATUSES = ["saved", "preparing", "applied", "interviewing", "offer", "rejected", "withdrawn"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface Application {
  id: string;
  job_id: string | null;
  company_id: string;
  company_name?: string;
  company_slug?: string;
  recruiter_id: string | null;
  title: string;
  url: string | null;
  status: ApplicationStatus;
  applied_at: string | null;
  notes: string | null;
  updated_at: string;
}
