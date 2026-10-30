import { authMode } from "@/lib/session";
import { LoginForm } from "./form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const mode = authMode();
  return (
    <main className="bg-grid grid min-h-screen place-items-center px-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-5">
          <p className="text-xs font-medium uppercase tracking-widest text-accent">SHPE 2026 · Indianapolis</p>
          <h1 className="mt-1 text-xl font-semibold">Career Intelligence Command Center</h1>
          <p className="mt-1 text-sm text-muted">Private workspace. Sign in to continue.</p>
        </div>
        {mode === "misconfigured" ? (
          <div className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
            Server sign-in is not configured. Set <code>APP_PASSWORD</code> and a 32+ character <code>SESSION_SECRET</code> (see README).
          </div>
        ) : (
          <LoginForm next={next ?? "/"} local={mode === "local"} />
        )}
      </div>
    </main>
  );
}
