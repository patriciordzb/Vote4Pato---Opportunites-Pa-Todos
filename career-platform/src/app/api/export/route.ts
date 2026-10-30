import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { q } from "@/lib/db";

export const runtime = "nodejs";

/** Download everything the app stores about you (documents as metadata only). */
export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const tables: Record<string, string> = {
    profile: `select data, preferences, version, updated_at from professional_profiles where user_id=$1`,
    linkedin: `select linkedin_sub, name, email, picture_url, scopes, connected_at from linkedin_connections where user_id=$1`,
    documents: `select id, kind, filename, size_bytes, created_at from documents where user_id=$1`,
    company_tracking: `select t.*, c.name as company from company_tracking t join companies c on c.id=t.company_id where user_id=$1`,
    recruiter_contacts: `select rc.*, r.full_name from recruiter_contacts rc join recruiters r on r.id=rc.recruiter_id where user_id=$1`,
    interactions: `select * from interactions where user_id=$1`,
    tasks: `select * from tasks where user_id=$1`,
    notes: `select * from notes where user_id=$1`,
    applications: `select * from applications where user_id=$1`,
    outreach_drafts: `select * from outreach_drafts where user_id=$1`,
  };
  const out: Record<string, unknown> = { exported_at: new Date().toISOString() };
  for (const [k, sql] of Object.entries(tables)) out[k] = await q(sql, [userId]);
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="shpe-command-center-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
