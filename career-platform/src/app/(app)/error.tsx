"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-lg p-6 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="mt-1 text-sm text-muted">{error.message || "Unexpected error"}{error.digest ? ` (ref ${error.digest})` : ""}</p>
      <button className="btn-primary mt-4" onClick={reset}>Try again</button>
    </div>
  );
}
