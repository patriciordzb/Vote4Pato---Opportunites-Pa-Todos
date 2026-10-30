import { cookies } from "next/headers";
import { Shell } from "@/components/shell";
import { aiConfigured } from "@/lib/ai";
import { getLinkedIn, getOwnerId, getProfile } from "@/lib/repo";
import { authMode } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await getOwnerId();
  const [li, profile] = await Promise.all([getLinkedIn(userId), getProfile(userId)]);
  const dark = (await cookies()).get("theme")?.value !== "light";
  return (
    <Shell status={{ ai: aiConfigured(), linkedin: Boolean(li), dark, local: authMode() === "local", name: profile.data.fullName || "Your profile" }}>
      {children}
    </Shell>
  );
}
