import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { exchangeCode, fetchUserInfo, idTokenNonce, LINKEDIN_SCOPES } from "@/lib/linkedin";

export const runtime = "nodejs";

function back(req: NextRequest, status: string) {
  const res = NextResponse.redirect(new URL(`/profile?linkedin=${status}`, req.url));
  res.cookies.delete({ name: "li_oauth", path: "/api/linkedin" });
  return res;
}

export async function GET(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const params = req.nextUrl.searchParams;
  if (params.get("error")) return back(req, params.get("error") === "user_cancelled_authorize" ? "cancelled" : "denied");

  const [expectedState, expectedNonce] = (req.cookies.get("li_oauth")?.value ?? "").split(".");
  const state = params.get("state");
  const code = params.get("code");
  if (!code || !state || !expectedState || state !== expectedState) return back(req, "state_mismatch");

  try {
    const token = await exchangeCode(code);
    const nonce = idTokenNonce(token.id_token);
    if (nonce && nonce !== expectedNonce) return back(req, "nonce_mismatch");
    const info = await fetchUserInfo(token.access_token);
    const locale = typeof info.locale === "string" ? info.locale : info.locale ? `${info.locale.language}_${info.locale.country}` : null;
    await q(
      `insert into linkedin_connections (user_id, linkedin_sub, name, given_name, family_name, email, email_verified, picture_url, locale,
         scopes, access_token_enc, token_expires_at, connected_at, last_synced_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now() + ($12 || ' seconds')::interval, now(), now())
       on conflict (user_id) do update set linkedin_sub=excluded.linkedin_sub, name=excluded.name, given_name=excluded.given_name,
         family_name=excluded.family_name, email=excluded.email, email_verified=excluded.email_verified, picture_url=excluded.picture_url,
         locale=excluded.locale, scopes=excluded.scopes, access_token_enc=excluded.access_token_enc,
         token_expires_at=excluded.token_expires_at, last_synced_at=now()`,
      [userId, info.sub, info.name ?? null, info.given_name ?? null, info.family_name ?? null, info.email ?? null,
        info.email_verified ?? null, info.picture ?? null, locale, token.scope ?? LINKEDIN_SCOPES.join(" "),
        encrypt(token.access_token), String(token.expires_in ?? 0)],
    );
    revalidatePath("/", "layout");
    return back(req, "connected");
  } catch (e) {
    console.error("LinkedIn callback failed:", e instanceof Error ? e.message : e);
    return back(req, "error");
  }
}
