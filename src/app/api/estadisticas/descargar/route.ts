import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { toCsv } from "@/lib/csv";
import { fechaCorta, leerDias } from "@/lib/estadisticas";
import { leerPedido, mensajeErrorSerie, slug } from "@/lib/estadisticas-pedido";
import { formatQrCode } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILAS = 200_000;

/**
 * Planilla de escaneos día por día, de una placa (?qr=44) o de todas las de
 * un cliente (?cliente=3), entre dos fechas. Una fila por placa y por día,
 * con los ceros incluidos: así se puede filtrar y sumar en Excel o Sheets.
 * Para mandarle al cliente está la imagen (/api/estadisticas/imagen).
 */
export async function GET(request: NextRequest) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const leido = await leerPedido(supabase, request.nextUrl.searchParams);
  if ("error" in leido) return new NextResponse(leido.error, { status: leido.status });
  const { rango, placas, nombre } = leido.pedido;

  const dias = (Date.parse(`${rango.hasta}T00:00:00Z`) - Date.parse(`${rango.desde}T00:00:00Z`)) / 86_400_000 + 1;
  if (dias * placas.length > MAX_FILAS) {
    return new NextResponse("Son demasiados días para tantas placas. Elegí un rango más corto.", { status: 413 });
  }

  const filas: (string | number)[][] = [["fecha", "placa", "etiqueta", "qr", "nfc", "total"]];
  // De a 8 placas a la vez: rápido sin saturar la base.
  for (let i = 0; i < placas.length; i += 8) {
    const tanda = placas.slice(i, i + 8);
    const series = await Promise.all(tanda.map((placa) => leerDias(supabase, placa.id, rango.desde, rango.hasta)));
    for (const [j, serie] of series.entries()) {
      if (serie.error) {
        const { texto, status } = mensajeErrorSerie(serie.error);
        return new NextResponse(texto, { status });
      }
      const placa = tanda[j];
      for (const dia of serie.data) {
        filas.push([fechaCorta(dia.fecha), formatQrCode(placa.id), placa.label ?? "", dia.qr, dia.nfc, dia.qr + dia.nfc]);
      }
    }
  }

  const archivo = `estadisticas-${slug(nombre)}-${rango.desde}-al-${rango.hasta}.csv`;
  // Con BOM: sin él, Excel muestra mal las tildes y las ñ.
  return new NextResponse(`﻿${toCsv(filas)}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${archivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
