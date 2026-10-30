import Link from "@/components/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="card max-w-sm p-6 text-center">
        <p className="text-sm text-muted">404</p>
        <h1 className="mt-1 text-lg font-semibold">This page or company isn&apos;t in your database</h1>
        <Link href="/companies" className="btn-primary mt-4">Back to Company Explorer</Link>
      </div>
    </main>
  );
}
