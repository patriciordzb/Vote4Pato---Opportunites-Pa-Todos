"use client";

import { useActionState } from "react";
import { signIn } from "@/app/actions";

export function LoginForm({ next, local }: { next: string; local: boolean }) {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      {local ? (
        <p className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-xs text-warn">
          Local development mode: <code>APP_PASSWORD</code> is not set, so no password is required. Set it before deploying.
        </p>
      ) : (
        <label className="block">
          <span className="label">App password</span>
          <input name="password" type="password" required autoComplete="current-password" className="input" autoFocus />
        </label>
      )}
      {state && !state.ok && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : local ? "Enter workspace" : "Sign in"}</button>
    </form>
  );
}
