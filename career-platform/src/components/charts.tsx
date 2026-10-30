"use client";

import Link from "@/components/link";
import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const AXIS = { stroke: "rgb(var(--muted))", fontSize: 11 };
const TOOLTIP = {
  contentStyle: { background: "rgb(var(--panel))", border: "1px solid rgb(var(--line))", borderRadius: 8, fontSize: 12, color: "rgb(var(--fg))" },
  labelStyle: { color: "rgb(var(--fg))", fontWeight: 600 },
  itemStyle: { color: "rgb(var(--fg))" },
  cursor: { fill: "rgb(var(--raised))" },
};

export const FACTOR_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];

export interface FactorRow {
  name: string;
  slug: string;
  technical: number;
  research: number;
  opportunities: number;
  industry: number;
  networking: number;
  total: number;
}

const FACTORS: { key: keyof Omit<FactorRow, "name" | "slug" | "total">; label: string }[] = [
  { key: "technical", label: "Technical (30)" },
  { key: "research", label: "Research (25)" },
  { key: "opportunities", label: "Opportunities (20)" },
  { key: "industry", label: "Industry (15)" },
  { key: "networking", label: "Networking (10)" },
];

/** Stacked weighted contributions: each segment = factor score × weight, so bars sum to the overall score. */
export function CompatibilityChart({ rows }: { rows: FactorRow[] }) {
  const [table, setTable] = useState(false);
  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button className="text-xs text-accent hover:underline" onClick={() => setTable((t) => !t)}>{table ? "Show chart" : "Show as table"}</button>
      </div>
      {table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted"><tr><th className="py-1 pr-2">Company</th>{FACTORS.map((f) => <th key={f.key} className="px-1">{f.label}</th>)}<th>Total</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.slug} className="border-t border-line">
                  <td className="py-1 pr-2"><Link className="hover:text-accent" href={`/companies/${r.slug}`}>{r.name}</Link></td>
                  {FACTORS.map((f) => <td key={f.key} className="px-1 tabular-nums">{r[f.key].toFixed(1)}</td>)}
                  <td className="font-semibold tabular-nums">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ height: Math.max(220, rows.length * 30 + 60) }} role="img" aria-label="Stacked compatibility score contributions by company">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }} barCategoryGap={6}>
              <CartesianGrid horizontal={false} stroke="rgb(var(--line))" strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={130} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP} formatter={(v, n) => [`${Number(v ?? 0).toFixed(1)} pts`, String(n)]} />
              <Legend wrapperStyle={{ fontSize: 11, color: "rgb(var(--muted))" }} />
              {FACTORS.map((f, i) => (
                <Bar key={f.key} dataKey={f.key} name={f.label} stackId="s" fill={FACTOR_COLORS[i]} stroke="rgb(var(--panel))" strokeWidth={2}
                  radius={i === FACTORS.length - 1 ? [0, 4, 4, 0] : undefined} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function ActivityChart({ data }: { data: { day: string; interactions: number }[] }) {
  if (!data.length) return <p className="py-8 text-center text-sm text-muted">No interactions logged yet. Log your first booth visit from any company page.</p>;
  return (
    <div className="h-48" role="img" aria-label="Interactions logged per day">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeDasharray="3 3" />
          <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip {...TOOLTIP} cursor={{ stroke: "rgb(var(--muted))" }} />
          <Line type="monotone" dataKey="interactions" name="Interactions" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "rgb(var(--panel))", fill: "var(--series-1)" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function IndustryChart({ data }: { data: { industry: string; count: number }[] }) {
  if (!data.length) return <p className="py-8 text-center text-sm text-muted">Track companies to see your pipeline by industry.</p>;
  return (
    <div style={{ height: Math.max(160, data.length * 28 + 30) }} role="img" aria-label="Tracked opportunities by industry">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="industry" width={140} tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip {...TOOLTIP} />
          <Bar dataKey="count" name="Companies" fill="var(--series-1)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
