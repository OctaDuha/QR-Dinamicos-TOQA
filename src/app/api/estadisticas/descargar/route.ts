import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { toCsv } from "@/lib/csv";
import { fechaArgentina, fechaCorta, leerDias, leerRango, rangoPorDefecto } from "@/lib/estadisticas";
import { formatQrCode, parseQrId } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILAS = 200_000;

/**
 * Planilla de escaneos día por día, de una placa (?qr=44) o de todas las de
 * un cliente (?cliente=3), entre dos fechas. Una fila por placa y por día,
 * con los ceros incluidos: así se puede filtrar y sumar en Excel o Sheets.
 */
export async function GET(request: NextRequest) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const hoy = fechaArgentina(new Date());
  const porDefecto = rangoPorDefecto(hoy);
  const rango = leerRango(params.get("desde") || porDefecto.desde, params.get("hasta") || porDefecto.hasta, hoy);
  if (!rango) return new NextResponse("Esas fechas no son válidas.", { status: 400 });

  const qrId = parseQrId(params.get("qr") ?? "");
  const clienteId = parseQrId(params.get("cliente") ?? "");

  let placas: { id: number; label: string | null }[] = [];
  let nombre: string;

  if (qrId !== null) {
    const { data } = await supabase.from("qr_codes").select("id, label").eq("id", qrId).maybeSingle();
    if (!data) return new NextResponse("Esa placa no existe.", { status: 404 });
    placas = [data as { id: number; label: string | null }];
    nombre = formatQrCode(qrId);
  } else if (clienteId !== null) {
    const [{ data: cliente }, { data: suyas, error }] = await Promise.all([
      supabase.from("clientes").select("nombre").eq("id", clienteId).maybeSingle<{ nombre: string }>(),
      supabase.from("qr_codes").select("id, label").eq("cliente_id", clienteId).order("id"),
    ]);
    if (error || !cliente) return new NextResponse("Ese cliente no existe.", { status: 404 });
    placas = (suyas ?? []) as { id: number; label: string | null }[];
    if (placas.length === 0) return new NextResponse("Ese cliente todavía no tiene placas.", { status: 404 });
    nombre = cliente.nombre;
  } else {
    return new NextResponse("Falta la placa o el cliente.", { status: 400 });
  }

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
        const falta = serie.error.code === "PGRST202";
        return new NextResponse(
          falta
            ? "Para descargar estadísticas falta correr en Supabase el archivo 2026-10-rango-fechas.sql."
            : `No pude leer las estadísticas: ${serie.error.message}`,
          { status: falta ? 501 : 500 },
        );
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

function slug(texto: string): string {
  return (
    texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "placas"
  );
}
