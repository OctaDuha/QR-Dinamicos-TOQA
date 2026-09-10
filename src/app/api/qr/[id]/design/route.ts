import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { respaldarDespues } from "@/lib/respaldo-auto";
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
  const nuevo = Number.isInteger(designId) && designId > 0 ? designId : null;

  // El diseno de un QR se elige una sola vez. Cambiarlo despues significaria
  // que el mismo numero puede salir impreso en dos placas distintas, y el
  // numero ya esta en el plastico.
  const { data: actual } = await supabase
    .from("qr_codes")
    .select("design_id")
    .eq("id", qrId)
    .maybeSingle<{ design_id: number | null }>();

  if (actual?.design_id != null && actual.design_id !== nuevo) {
    return NextResponse.json(
      {
        error:
          "Este QR ya está asignado a un diseño y no se puede cambiar: el número va impreso, " +
          "y el mismo número no puede existir en dos placas distintas.",
      },
      { status: 409 },
    );
  }

  const { error } = await supabase.from("qr_codes").update({ design_id: nuevo }).eq("id", qrId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  respaldarDespues(supabase);

  return NextResponse.json({ ok: true });
}
