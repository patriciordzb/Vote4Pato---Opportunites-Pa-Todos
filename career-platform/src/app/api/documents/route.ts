import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { sha256Hex } from "@/lib/crypto";
import { getProfile } from "@/lib/repo";
import { DOCUMENT_KINDS, MAX_UPLOAD_BYTES, analyzeDocument, extractPdfText, isPdf } from "@/lib/documents";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const fd = await req.formData().catch(() => null);
  const file = fd?.get("file");
  const kind = String(fd?.get("kind") ?? "other");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (!DOCUMENT_KINDS.includes(kind as (typeof DOCUMENT_KINDS)[number])) return NextResponse.json({ error: "Unknown document type" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "File is empty" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "File is larger than 10 MB" }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(bytes)) return NextResponse.json({ error: "Only PDF files are accepted (file content is not a PDF)" }, { status: 415 });
  const filename = file.name.replace(/[^\w.\- ()]+/g, "_").slice(0, 200) || "document.pdf";

  let text = "";
  try {
    text = await extractPdfText(bytes);
  } catch {
    text = "";
  }
  const profile = await getProfile(userId);
  const analysis = await analyzeDocument(text, kind, profile.data);
  if (!text) analysis.notes.unshift("No text could be extracted (the PDF may be scanned images). The file is stored, but nothing was analyzed.");

  const hash = sha256Hex(bytes);
  const rows = await q<{ id: string }>(
    `insert into documents (user_id, kind, filename, mime_type, size_bytes, sha256, content, extracted_text, analysis)
     values ($1,$2,$3,'application/pdf',$4,$5,$6,$7,$8)
     on conflict (user_id, sha256) do update set kind=excluded.kind, filename=excluded.filename, extracted_text=excluded.extracted_text,
       analysis=excluded.analysis, review_status='pending'
     returning id`,
    [userId, kind, filename, bytes.length, hash, Buffer.from(bytes), text, JSON.stringify(analysis)],
  );
  revalidatePath("/profile");
  return NextResponse.json({ id: rows[0].id, analysis });
}
