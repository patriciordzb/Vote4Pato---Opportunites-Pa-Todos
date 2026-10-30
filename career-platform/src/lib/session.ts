// Signed session cookie, using Web Crypto so the same code runs in
// middleware (edge runtime) and in Node route handlers.

export const SESSION_COOKIE = "cc_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export function sessionSecret(): string | null {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV !== "production") return "dev-only-insecure-session-secret-change-me";
  return null;
}

export function authMode(): "password" | "local" | "misconfigured" {
  if (process.env.APP_PASSWORD) return sessionSecret() ? "password" : "misconfigured";
  return process.env.NODE_ENV === "production" ? "misconfigured" : "local";
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSessionToken(payload: { sub: string }): Promise<string> {
  const secret = sessionSecret();
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  const body = b64url(enc.encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<{ sub: string } | null> {
  const secret = sessionSecret();
  if (!token || !secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromB64url(sig) as BufferSource, enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as { sub: string; exp: number };
    if (payload.exp < Date.now() / 1000) return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
