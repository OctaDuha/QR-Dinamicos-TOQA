import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { normalizeLayout } from "@/lib/placa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Renombrar el diseño y/o guardar la posición del QR. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const designId = Number((await context.params).id);
  if (!Number.isInteger(designId)) {
    return NextResponse.json({ error: "Diseño inválido." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    layout?: unknown;
  };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (body.layout !== undefined) patch.layout = normalizeLayout(body.layout);

  const { error } = await supabase.from("placa_designs").update(patch).eq("id", designId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const designId = Number((await context.params).id);
  if (!Number.isInteger(designId)) {
    return NextResponse.json({ error: "Diseño inválido." }, { status: 400 });
  }

  // Los QR que lo usaban quedan sin diseño, pero no se borran: la placa
  // física ya impresa sigue existiendo.
  const { error } = await supabase.from("placa_designs").delete().eq("id", designId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
