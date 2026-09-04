import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { loadDesign } from "@/lib/placa-designs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** El PDF de fondo crudo. Lo usa el detector de QR del navegador. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const designId = Number((await context.params).id);
  if (!Number.isInteger(designId)) {
    return new NextResponse("Diseño inválido", { status: 400 });
  }

  const design = await loadDesign(supabase, designId);
  if (!design?.backgroundPdf) {
    return new NextResponse("Ese diseño no tiene fondo cargado", { status: 404 });
  }

  return new NextResponse(new Uint8Array(design.backgroundPdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
    },
  });
}
