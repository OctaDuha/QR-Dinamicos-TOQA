import JSZip from "jszip";
import { NextResponse } from "next/server";

import { exportCsv, pngFileName } from "@/lib/export";
import { fetchQrCodes, readRange } from "@/lib/export-query";
import { qrPngBuffer, siteUrl } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Tope por ZIP: mas que esto conviene bajarlo por tandas con ?from=&to=. */
const MAX_PNGS = 1000;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const url = new URL(request.url);
  const range = readRange(url);

  let codes;
  try {
    codes = await fetchQrCodes(supabase, range, MAX_PNGS + 1);
  } catch (error) {
    return new NextResponse(`Error al leer los QR: ${(error as Error).message}`, { status: 500 });
  }

  if (codes.length > MAX_PNGS) {
    return new NextResponse(
      `Son ${codes.length} QR y el ZIP admite hasta ${MAX_PNGS} por tanda. ` +
        `Bajalos por rango, por ejemplo /api/export/zip?from=1&to=${MAX_PNGS}`,
      { status: 413 },
    );
  }

  const base = siteUrl();
  const zip = new JSZip();
  const folder = zip.folder("png")!;

  for (const code of codes) {
    folder.file(pngFileName(code.id), await qrPngBuffer(code.id, base, 1024));
  }

  zip.file("qrs.csv", exportCsv(codes, base));
  zip.file(
    "LEEME.txt",
    [
      "QR dinámicos TOQA",
      "",
      "png/       una imagen por QR, lista para subir a Canva.",
      "qrs.csv    columnas numero, qr_code, destino_actual, url_qr",
      "",
      "El QR impreso apunta siempre a la misma URL (url_qr).",
      "Para cambiar a dónde lleva, editá el destino en el panel: la placa no se toca.",
      "",
      `Generado: ${new Date().toISOString()}`,
    ].join("\n"),
  );

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="qrs-toqa-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
