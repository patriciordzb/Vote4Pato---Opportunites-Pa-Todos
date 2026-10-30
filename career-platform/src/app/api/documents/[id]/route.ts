import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { q, q1 } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!UUID.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const doc = await q1<{ filename: string; content: Uint8Array }>(`select filename, content from documents where id=$1 and user_id=$2`, [id, userId]);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(Buffer.from(doc.content), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!UUID.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  await q(`delete from documents where id=$1 and user_id=$2`, [id, userId]);
  revalidatePath("/profile");
  return NextResponse.json({ ok: true });
}
