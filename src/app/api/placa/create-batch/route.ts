import JSZip from "jszip";
import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { placaFileName, renderPlacas, type PlacaItem } from "@/lib/placa";
import { loadDesign } from "@/lib/placa-designs";
import { formatQrCode, normalizeDestination, siteUrl } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX = 1000;

/**
 * El camino corto: decis cuantas placas querés y de qué diseño, y en una sola
 * operación se crean los QR nuevos (numerados a continuación de los que ya
 * existen) y sale el PDF listo para imprenta.
 */
export async function POST(request: NextRequest) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    count?: number;
    designId?: number;
    destination?: string;
    labelPrefix?: string;
    zip?: boolean;
  };

  const count = Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > MAX) {
    return NextResponse.json(
      { error: `La cantidad tiene que estar entre 1 y ${MAX}.` },
      { status: 400 },
    );
  }

  const destination = normalizeDestination(String(body.destination ?? ""));
  if (!destination) {
    return NextResponse.json({ error: "El destino no es una URL válida." }, { status: 400 });
  }

  const designId = Number(body.designId);
  if (!Number.isInteger(designId) || designId <= 0) {
    return NextResponse.json({ error: "Elegí un diseño." }, { status: 400 });
  }

  const design = await loadDesign(supabase, designId);
  if (!design) {
    return NextResponse.json({ error: "Ese diseño no existe." }, { status: 404 });
  }
  if (!design.backgroundPdf) {
    return NextResponse.json(
      { error: `El diseño “${design.name}” no tiene el PDF de fondo cargado.` },
      { status: 400 },
    );
  }

  // 1. Crear los QR. Se numeran solos, a continuación de los existentes.
  const { data, error } = await supabase
    .from("qr_codes")
    .insert(
      Array.from({ length: count }, () => ({
        destination_url: destination,
        design_id: designId,
      })),
    )
    .select("id");

  if (error) {
    return NextResponse.json({ error: `No pude crear los QR: ${error.message}` }, { status: 500 });
  }

  const ids = (data ?? []).map((row) => row.id as number).sort((a, b) => a - b);
  if (ids.length === 0) {
    return NextResponse.json({ error: "No se creó ningún QR." }, { status: 500 });
  }

  const prefix = String(body.labelPrefix ?? "").trim();
  if (prefix) {
    await supabase.from("qr_codes").upsert(
      ids.map((id) => ({
        id,
        label: count === 1 ? prefix : `${prefix} ${formatQrCode(id)}`,
        destination_url: destination,
        design_id: designId,
      })),
    );
  }

  // 2. Generar las placas de esos QR, con el diseño elegido.
  const base = siteUrl();
  const items: PlacaItem[] = ids.map((qrId) => ({ qrId, design }));

  // El rango creado viaja en cabeceras: si el navegador cancela la descarga,
  // los números ya existen y se pueden volver a generar por rango.
  const range = {
    "X-Qr-From": formatQrCode(ids[0]),
    "X-Qr-To": formatQrCode(ids[ids.length - 1]),
    "X-Qr-Count": String(ids.length),
    "Access-Control-Expose-Headers": "X-Qr-From, X-Qr-To, X-Qr-Count",
    "Cache-Control": "no-store",
  };

  if (body.zip) {
    const zip = new JSZip();
    for (const item of items) {
      zip.file(`placa-${formatQrCode(item.qrId)}.pdf`, await renderPlacas({ items: [item], baseUrl: base }));
    }
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        ...range,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="placas-toqa-${stamp}.zip"`,
      },
    });
  }

  const pdf = await renderPlacas({ items, baseUrl: base });

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      ...range,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${placaFileName(ids, design.name)}"`,
    },
  });
}
