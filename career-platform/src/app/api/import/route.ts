import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireUserId } from "@/lib/auth";
import { q } from "@/lib/db";
import { csvToDataset, importDataset } from "@/lib/dataset";

export const runtime = "nodejs";

const MAX = 5 * 1024 * 1024;

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const fd = await req.formData().catch(() => null);
  const file = fd?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "File larger than 5 MB" }, { status: 413 });
  const text = await file.text();
  try {
    const isCsv = /\.csv$/i.test(file.name) || (!text.trim().startsWith("{") && text.includes(","));
    const data = isCsv ? csvToDataset(text) : JSON.parse(text);
    const summary = await importDataset((sql, params) => q(sql, params), data, "import");
    await q(`insert into data_imports (user_id, kind, filename, summary) values ($1,$2,$3,$4)`,
      [userId, isCsv ? "csv" : "json", file.name.slice(0, 200), JSON.stringify(summary)]);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", issues: e.issues.slice(0, 20).map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 422 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Import failed" }, { status: 400 });
  }
}
