import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { randomToken } from "@/lib/crypto";
import { authorizeUrl, linkedinConfig } from "@/lib/linkedin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await requireUserId();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (!linkedinConfig()) {
    return NextResponse.redirect(new URL("/profile?linkedin=not_configured", req.url));
  }
  const state = randomToken();
  const nonce = randomToken();
  const res = NextResponse.redirect(authorizeUrl(state, nonce));
  res.cookies.set("li_oauth", `${state}.${nonce}`, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/linkedin", maxAge: 600,
  });
  return res;
}
