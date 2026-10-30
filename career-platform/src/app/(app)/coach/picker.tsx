"use client";

import { useRouter } from "next/navigation";

export function CompanyPicker({ companies, value, param = "company", basePath = "/coach" }: { companies: { slug: string; name: string; score: number }[]; value: string; param?: string; basePath?: string }) {
  const router = useRouter();
  return (
    <label className="block max-w-md">
      <span className="label">Company</span>
      <select className="input" value={value} onChange={(e) => router.push(`${basePath}?${param}=${e.target.value}`)}>
        {companies.map((c) => <option key={c.slug} value={c.slug}>{c.name} · {c.score}</option>)}
      </select>
    </label>
  );
}
