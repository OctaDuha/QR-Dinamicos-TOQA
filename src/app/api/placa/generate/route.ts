import JSZip from "jszip";
import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { fetchQrCodes, readRange } from "@/lib/export-query";
import { placaFileName, renderPlacas, type PlacaItem } from "@/lib/placa";
import { loadDesign, loadDesigns } from "@/lib/placa-designs";
import { formatQrCode, siteUrl } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_PLACAS = 1000;

/**
 * Genera el lote listo para imprenta.
 *   ?design=N  -> fuerza ese diseño para todas
 *   sin design -> cada QR usa el diseño con el que se creó
 *   ?zip=1     -> un PDF por placa dentro de un ZIP
 */
export async function GET(request: NextRequest) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const url = new URL(request.url);
  const range = readRange(url);
  const forcedId = Number(url.searchParams.get("design"));
  const hasForced = Number.isInteger(forcedId) && forcedId > 0;

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

  const forced = hasForced ? await loadDesign(supabase, forcedId) : null;
  if (hasForced && !forced) {
    return new NextResponse("Ese diseño no existe.", { status: 404 });
  }
  if (forced && !forced.backgroundPdf) {
    return new NextResponse(
      `El diseño “${forced.name}” no tiene el PDF de fondo cargado.`,
      { status: 400 },
    );
  }

  const byId = forced
    ? new Map()
    : await loadDesigns(
        supabase,
        codes.map((code) => code.design_id).filter((id): id is number => typeof id === "number"),
      );

  const items: PlacaItem[] = [];
  const sinDiseno: number[] = [];

  for (const code of codes) {
    const design = forced ?? (code.design_id ? byId.get(code.design_id) : undefined);
    if (!design || !design.backgroundPdf) {
      sinDiseno.push(code.id);
      continue;
    }
    items.push({ qrId: code.id, design });
  }

  if (items.length === 0) {
    return new NextResponse(
      "Ninguno de esos QR tiene un diseño con fondo cargado. Elegí un diseño o asignáselo a los QR.",
      { status: 400 },
    );
  }
  if (sinDiseno.length > 0) {
    return new NextResponse(
      `Estos QR no tienen diseño asignado: ${sinDiseno.slice(0, 10).map(formatQrCode).join(", ")}` +
        `${sinDiseno.length > 10 ? ` y ${sinDiseno.length - 10} más` : ""}. ` +
        "Elegí un diseño para todo el lote, o asignáselo a esos QR.",
      { status: 400 },
    );
  }

  const base = siteUrl();
  const stamp = new Date().toISOString().slice(0, 10);
  const designName = forced?.name ?? (byId.size === 1 ? [...byId.values()][0].name : undefined);

  if (url.searchParams.get("zip") === "1") {
    const zip = new JSZip();

    for (const item of items) {
      const pdf = await renderPlacas({ items: [item], baseUrl: base });
      zip.file(`placa-${formatQrCode(item.qrId)}.pdf`, pdf);
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

  const pdf = await renderPlacas({ items, baseUrl: base });

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${placaFileName(items.map((i) => i.qrId), designName)}"`,
      "Cache-Control": "no-store",
    },
  });
}
