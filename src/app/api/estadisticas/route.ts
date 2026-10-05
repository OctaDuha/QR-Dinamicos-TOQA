import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { fechaArgentina, leerRango, leerSerieRango, rangoPorDefecto } from "@/lib/estadisticas";
import { parseQrId } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Las estadísticas de una placa entre dos fechas, para mostrarlas sin salir
 * de otra pantalla (la ficha del cliente). Sin fechas, los últimos 30 días.
 */
export async function GET(request: NextRequest) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const id = parseQrId(params.get("qr") ?? "");
  if (id === null) return NextResponse.json({ error: "Placa inválida." }, { status: 400 });

  const hoy = fechaArgentina(new Date());
  const pedido = params.get("desde") && params.get("hasta") ? params : null;
  const porDefecto = rangoPorDefecto(hoy);
  const rango = leerRango(pedido?.get("desde") ?? porDefecto.desde, pedido?.get("hasta") ?? porDefecto.hasta, hoy);
  if (!rango) return NextResponse.json({ error: "Esas fechas no son válidas." }, { status: 400 });

  const serie = await leerSerieRango(supabase, id, rango);
  if (serie.error) {
    const falta = serie.error.code === "PGRST202";
    return NextResponse.json(
      {
        error: falta
          ? "Para ver estadísticas por fechas falta correr en Supabase el archivo 2026-10-rango-fechas.sql."
          : `No pude leer las estadísticas: ${serie.error.message}`,
      },
      { status: falta ? 501 : 500 },
    );
  }

  const qr = serie.data.reduce((total, punto) => total + (punto.qr ?? 0), 0);
  const nfc = serie.data.reduce((total, punto) => total + (punto.nfc ?? 0), 0);

  return NextResponse.json(
    { desde: rango.desde, hasta: rango.hasta, bucket: rango.bucket, serie: serie.data, qr, nfc, total: qr + nfc },
    { headers: { "Cache-Control": "no-store" } },
  );
}
