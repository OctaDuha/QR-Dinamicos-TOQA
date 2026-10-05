import type { SupabaseClient } from "@supabase/supabase-js";

import type { ScanBucket, ScanSeriesPoint } from "./types";

/**
 * Lo que comparten la pantalla de cada placa, la ficha del cliente y la
 * descarga: leer un rango de fechas y pedirle a la base los escaneos de ese
 * rango, separados en QR y NFC.
 */

export type SerieLeida = { data: ScanSeriesPoint[]; error: { message: string; code?: string } | null };

export const NOMBRE_BUCKET: Record<ScanBucket, string> = {
  day: "día",
  week: "semana",
  month: "mes",
  year: "año",
};

export type Rango = { desde: string; hasta: string; bucket: ScanBucket; recortadoAHoy: boolean };

/**
 * Las fechas del calendario, ya ordenadas y con el agrupado que conviene.
 *
 * El agrupado sale del largo del rango, para que siempre se lea: un año por
 * dia serian 365 barras imposibles de mirar. Las fechas futuras se recortan a
 * hoy, porque escaneos del futuro no hay: elegir "hasta 2030" muestra todo
 * hasta hoy, que es lo que se quiere ver.
 */
export function leerRango(rawDesde: string | undefined, rawHasta: string | undefined, hoy: string): Rango | null {
  // Ida y vuelta: JavaScript convierte el 30 de febrero en 2 de marzo sin
  // avisar, y la base despues lo rechazaria. Solo pasa lo que existe.
  const valida = (v: string | undefined) => {
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const ms = Date.parse(`${v}T00:00:00Z`);
    return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === v ? v : null;
  };
  let desde = valida(rawDesde);
  let hasta = valida(rawHasta);
  if (!desde || !hasta) return null;

  const recortadoAHoy = hasta > hoy;
  if (desde > hoy) desde = hoy;
  if (hasta > hoy) hasta = hoy;
  if (desde > hasta) [desde, hasta] = [hasta, desde];

  const dias = (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000;
  const bucket: ScanBucket = dias <= 62 ? "day" : dias <= 366 ? "week" : dias <= 3660 ? "month" : "year";

  return { desde, hasta, bucket, recortadoAHoy };
}

export async function leerSerieRango(supabase: SupabaseClient, id: number, rango: Rango): Promise<SerieLeida> {
  const { data, error } = await supabase.rpc("qr_scan_series_rango", {
    p_qr_id: id,
    p_bucket: rango.bucket,
    p_desde: rango.desde,
    p_hasta: rango.hasta,
  });
  if (error) return { data: [], error };

  const filas = (data ?? []) as { bucket_start: string; qr: number; nfc: number }[];
  return {
    data: filas.map((fila) => {
      const qr = Number(fila.qr);
      const nfc = Number(fila.nfc);
      return { bucket_start: fila.bucket_start, scans: qr + nfc, qr, nfc };
    }),
    error: null,
  };
}

/** La fecha de hoy (o de cualquier momento) como dia de Argentina, AAAA-MM-DD. */
export function fechaArgentina(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

export function fechaCorta(iso: string): string {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

/** Los últimos 30 días, hoy incluido, que es lo que se muestra al abrir. */
export function rangoPorDefecto(hoy: string): { desde: string; hasta: string } {
  const desde = new Date(Date.parse(`${hoy}T00:00:00Z`) - 29 * 86_400_000).toISOString().slice(0, 10);
  return { desde, hasta: hoy };
}

/** Día por día, para la descarga: cada fila es un día de Argentina. */
export async function leerDias(
  supabase: SupabaseClient,
  id: number,
  desde: string,
  hasta: string,
): Promise<{ data: { fecha: string; qr: number; nfc: number }[]; error: { message: string; code?: string } | null }> {
  const { data, error } = await supabase.rpc("qr_scan_series_rango", {
    p_qr_id: id,
    p_bucket: "day",
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) return { data: [], error };
  return {
    data: ((data ?? []) as { bucket_start: string; qr: number; nfc: number }[]).map((fila) => ({
      fecha: fila.bucket_start.slice(0, 10),
      qr: Number(fila.qr),
      nfc: Number(fila.nfc),
    })),
    error: null,
  };
}
