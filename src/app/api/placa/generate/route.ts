import JSZip from "jszip";
import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { fetchQrCodes, readRange } from "@/lib/export-query";
import { placaFileName, renderPlacas } from "@/lib/placa";
import { loadPlacaSettings } from "@/lib/placa-settings";
import { formatQrCode, siteUrl } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_PLACAS = 1000;

/**
 * Genera el lote de placas listo para imprenta.
 *   ?zip=1  -> un PDF por placa dentro de un ZIP
 *   por defecto -> un unico PDF multipagina (lo que suele pedir la imprenta)
 */
export async function GET(request: NextRequest) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const url = new URL(request.url);
  const range = readRange(url);

  let codes;
  try {
    codes = await fetchQrCodes(supabase, range, MAX_PLACAS + 1);
  } catch (error) {
    return new NextResponse(`Error al leer los QR: ${(error as Error).message}`, { status: 500 });
  }

  if (codes.length === 0) {
    return new NextResponse("No hay QR en ese rango.", { status: 400 });
  }
  if (codes.length > MAX_PLACAS) {
    return new NextResponse(
      `Son ${codes.length} placas y el máximo por tanda es ${MAX_PLACAS}. Acotá el rango con desde/hasta.`,
      { status: 413 },
    );
  }

  const settings = await loadPlacaSettings(supabase, true);

  if (!settings.backgroundPdf) {
    return new NextResponse(
      "Todavía no cargaste el fondo. Subí el PDF exportado de Canva en Placas para imprenta.",
      { status: 400 },
    );
  }

  const ids = codes.map((code) => code.id);
  const base = siteUrl();
  const stamp = new Date().toISOString().slice(0, 10);

  if (url.searchParams.get("zip") === "1") {
    const zip = new JSZip();

    for (const id of ids) {
      const pdf = await renderPlacas({
        ids: [id],
        backgroundPdf: settings.backgroundPdf,
        layout: settings.layout,
        baseUrl: base,
      });
      zip.file(`placa-${formatQrCode(id)}.pdf`, pdf);
    }

    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="placas-toqa-${stamp}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const pdf = await renderPlacas({
    ids,
    backgroundPdf: settings.backgroundPdf,
    layout: settings.layout,
    baseUrl: base,
  });

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${placaFileName(ids)}"`,
      "Cache-Control": "no-store",
    },
  });
}
