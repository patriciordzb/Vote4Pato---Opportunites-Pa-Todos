"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "@/app/actions";

/**
 * Submits a form to a server action from onSubmit inside a transition.
 * Unlike <form action>/useActionState, React doesn't auto-reset the form, so
 * inputs keep their values when the server returns a validation error; callers
 * reset explicitly on success.
 */
export function useFormAction(fn: (prev: unknown, fd: FormData) => Promise<ActionResult>) {
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        setState(await fn(null, fd));
      } catch (err) {
        setState({ ok: false, error: err instanceof Error ? err.message : "Request failed" });
      }
    });
  };
  return [state, onSubmit, pending] as const;
}
