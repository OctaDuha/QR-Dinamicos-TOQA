import { PDFDocument } from "pdf-lib";
import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 12 * 1024 * 1024;

/** Guarda el PDF exportado de Canva como fondo de las placas. */
export async function POST(request: NextRequest) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Elegí el PDF exportado de Canva." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "El PDF supera los 12 MB." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  let pages: number;
  let width: number;
  let height: number;
  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    pages = pdf.getPageCount();
    if (pages === 0) throw new Error("El PDF no tiene páginas.");
    width = pdf.getPage(0).getWidth();
    height = pdf.getPage(0).getHeight();
  } catch (error) {
    return NextResponse.json(
      { error: `No pude leer el PDF: ${(error as Error).message}` },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("placa_settings").upsert({
    id: 1,
    background_pdf: bytes.toString("base64"),
    background_name: file.name,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    name: file.name,
    pages,
    widthMm: round(width / (72 / 25.4)),
    heightMm: round(height / (72 / 25.4)),
  });
}

const round = (value: number) => Math.round(value * 10) / 10;
