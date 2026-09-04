import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { parseQrId } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Asigna (o cambia) el diseño con el que se imprime este QR. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const qrId = parseQrId((await context.params).id);
  if (qrId === null) {
    return NextResponse.json({ error: "QR inválido." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { designId?: number };
  const designId = Number(body.designId);

  const { error } = await supabase
    .from("qr_codes")
    .update({ design_id: Number.isInteger(designId) && designId > 0 ? designId : null })
    .eq("id", qrId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
