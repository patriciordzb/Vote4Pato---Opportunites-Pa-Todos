"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { ActionResult } from "@/app/actions";

/**
 * Like useActionState, but submits via onSubmit so React does not auto-reset
 * the form. Inputs keep their values when the server returns a validation
 * error; callers reset explicitly on success.
 */
export function useFormAction(fn: (prev: unknown, fd: FormData) => Promise<ActionResult>) {
  const [state, action, pending] = useActionState(fn, null);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
  return [state, onSubmit, pending] as const;
}
