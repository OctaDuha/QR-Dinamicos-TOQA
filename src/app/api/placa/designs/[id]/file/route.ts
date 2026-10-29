import { PDFDocument } from "pdf-lib";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { MM, resizeBackground } from "@/lib/placa";
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

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * Cambia el PDF de fondo de un diseño que ya existe (por ejemplo, el mismo
 * diseño exportado de nuevo desde Canva "para imprimir"). El diseño sigue
 * siendo el mismo: los números ya asignados siguen atados a él y la posición
 * del QR y del número no cambia. Si el PDF nuevo no mide lo mismo, se ajusta
 * a la medida del diseño.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const designId = Number((await context.params).id);
  if (!Number.isInteger(designId)) {
    return NextResponse.json({ error: "Diseño inválido." }, { status: 400 });
  }

  const { data: actual } = await supabase
    .from("placa_designs")
    .select("id, page_width_mm, page_height_mm")
    .eq("id", designId)
    .maybeSingle<{ id: number; page_width_mm: number | null; page_height_mm: number | null }>();
  if (!actual) return NextResponse.json({ error: "Ese diseño no existe." }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Elegí el PDF nuevo del diseño." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "El PDF supera los 12 MB." }, { status: 400 });
  }

  let bytes: Buffer = Buffer.from(await file.arrayBuffer());
  let pageCount: number;
  let widthMm: number;
  let heightMm: number;
  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    pageCount = pdf.getPageCount();
    if (pageCount === 0) throw new Error("El PDF no tiene páginas.");
    widthMm = pdf.getPage(0).getWidth() / MM;
    heightMm = pdf.getPage(0).getHeight() / MM;
  } catch (error) {
    return NextResponse.json({ error: `No pude leer el PDF: ${(error as Error).message}` }, { status: 400 });
  }

  let ajustado = false;
  if (
    actual.page_width_mm &&
    actual.page_height_mm &&
    (Math.abs(widthMm - actual.page_width_mm) > 0.5 || Math.abs(heightMm - actual.page_height_mm) > 0.5)
  ) {
    try {
      bytes = await resizeBackground(bytes, actual.page_width_mm, actual.page_height_mm);
      ajustado = true;
    } catch (error) {
      return NextResponse.json({ error: `No pude ajustar el tamaño: ${(error as Error).message}` }, { status: 400 });
    }
  }

  const { error } = await supabase
    .from("placa_designs")
    .update({
      background_pdf: bytes.toString("base64"),
      background_name: file.name,
      page_count: pageCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", designId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, background_name: file.name, page_count: pageCount, ajustado });
}
