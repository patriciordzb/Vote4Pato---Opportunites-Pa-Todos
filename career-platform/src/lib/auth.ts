import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./session";
import { getOwnerId } from "./repo";

/** Defense in depth: middleware already blocks unauthenticated requests, but
 * every mutation re-checks the session and resolves the user it belongs to. */
export async function requireUserId(): Promise<string> {
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) throw new Error("Not signed in");
  const owner = await getOwnerId();
  if (session.sub !== owner) throw new Error("Session does not match this account");
  return owner;
}
