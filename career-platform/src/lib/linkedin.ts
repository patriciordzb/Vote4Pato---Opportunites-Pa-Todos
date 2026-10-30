import "server-only";

// LinkedIn "Sign In with LinkedIn using OpenID Connect".
// Scopes openid/profile/email grant: name, picture, email, locale and the
// member's stable subject id. They do NOT grant work history, education,
// skills, connections or messaging. Those need separate LinkedIn partner
// approval, so the app uses PDF/manual import for that data instead.

export const LINKEDIN_SCOPES = ["openid", "profile", "email"];
const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

export function linkedinConfig() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri: `${appUrl.replace(/\/$/, "")}/api/linkedin/callback` };
}

export function authorizeUrl(state: string, nonce: string) {
  const cfg = linkedinConfig();
  if (!cfg) throw new Error("LinkedIn is not configured");
  const u = new URL(AUTH_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", cfg.clientId);
  u.searchParams.set("redirect_uri", cfg.redirectUri);
  u.searchParams.set("state", state);
  u.searchParams.set("nonce", nonce);
  u.searchParams.set("scope", LINKEDIN_SCOPES.join(" "));
  return u.toString();
}

export interface LinkedInUserInfo {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
  locale?: string | { country: string; language: string };
}

export async function exchangeCode(code: string) {
  const cfg = linkedinConfig();
  if (!cfg) throw new Error("LinkedIn is not configured");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: cfg.redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`LinkedIn token exchange failed (${res.status})`);
  return (await res.json()) as { access_token: string; expires_in: number; scope?: string; id_token?: string };
}

export async function fetchUserInfo(accessToken: string): Promise<LinkedInUserInfo> {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`LinkedIn userinfo failed (${res.status})`);
  return (await res.json()) as LinkedInUserInfo;
}

/** Decode the id_token payload. The nonce is checked; the token itself came over TLS directly from LinkedIn. */
export function idTokenNonce(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")) as { nonce?: string };
    return payload.nonce ?? null;
  } catch {
    return null;
  }
}
