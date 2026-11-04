import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { PDFDocument } from "pdf-lib";

import { normalizeLayout } from "@/lib/placa";
import { cajaDeCorte } from "@/lib/plantilla-imprenta";

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
  if (body.layout !== undefined) {
    // Si es o no una plantilla de imprenta no lo decide el navegador: sale
    // del PDF guardado. Así un guardado con datos viejos no la desarma.
    const { data } = await supabase
      .from("placa_designs")
      .select("background_pdf")
      .eq("id", designId)
      .maybeSingle<{ background_pdf: string | null }>();
    let imprenta = null;
    if (data?.background_pdf) {
      try {
        const pdf = await PDFDocument.load(Buffer.from(data.background_pdf, "base64"), { ignoreEncryption: true });
        imprenta = cajaDeCorte(pdf.getPage(0));
      } catch {
        // Un PDF que no se puede leer no es plantilla.
      }
    }
    patch.layout = { ...normalizeLayout(body.layout), imprenta };
  }

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
