import { PDFDocument } from "pdf-lib";
import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { listDesigns } from "@/lib/placa-designs";
import { DEFAULT_LAYOUT, MM } from "@/lib/placa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 12 * 1024 * 1024;

export async function GET() {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  return NextResponse.json({ designs: await listDesigns(supabase) });
}

/** Diseño nuevo: nombre + el PDF exportado de Canva. */
export async function POST(request: NextRequest) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const file = form.get("file");

  if (!name) {
    return NextResponse.json({ error: "Ponele un nombre al diseño." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Elegí el PDF exportado de Canva." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "El PDF supera los 12 MB." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  let pageCount: number;
  let widthMm: number;
  let heightMm: number;
  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    pageCount = pdf.getPageCount();
    if (pageCount === 0) throw new Error("El PDF no tiene páginas.");
    widthMm = round(pdf.getPage(0).getWidth() / MM);
    heightMm = round(pdf.getPage(0).getHeight() / MM);
  } catch (error) {
    return NextResponse.json(
      { error: `No pude leer el PDF: ${(error as Error).message}` },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("placa_designs")
    .insert({
      name,
      background_pdf: bytes.toString("base64"),
      background_name: file.name,
      page_width_mm: widthMm,
      page_height_mm: heightMm,
      page_count: pageCount,
      layout: DEFAULT_LAYOUT,
    })
    .select("id, name, background_name, page_width_mm, page_height_mm, page_count, layout, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "No pude guardar el diseño." }, { status: 500 });
  }

  return NextResponse.json({ design: data });
}

const round = (value: number) => Math.round(value * 10) / 10;
