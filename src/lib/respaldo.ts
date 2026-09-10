import type { SupabaseClient } from "@supabase/supabase-js";
import { list, put } from "@vercel/blob";

import { exportCsv } from "./export";
import { fetchQrCodes } from "./export-query";
import { designNames } from "./placa-designs";
import { siteUrl } from "./qr";

/**
 * Copia de seguridad de la lista de QR.
 *
 * El plan gratuito de Supabase no hace copias. Si la base se pierde, las
 * placas impresas quedan muertas aunque el dominio siga funcionando: el
 * numero ya no tiene a donde redirigir. Esta copia es lo unico que permite
 * reconstruirla, y por eso se guarda sola cada vez que la lista cambia, en
 * vez de depender de que alguien se acuerde de bajarla.
 *
 * Vive en el almacen de archivos de Vercel. Eso cubre el escenario probable
 * —perder la base— pero no el de perder la cuenta de Vercel, porque vive
 * ahi adentro. Para eso sigue haciendo falta bajar el CSV a mano cada tanto.
 *
 * Sin BLOB_READ_WRITE_TOKEN todo esto queda inerte y el resto del sistema
 * funciona igual.
 */

const NOMBRE = "respaldos/qrs.csv";
const MAX_FILAS = 20000;

export function respaldoConfigurado(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export type EstadoRespaldo = {
  configurado: boolean;
  fecha: string | null;
  tamano: number | null;
  url: string | null;
};

/** Cuando se guardo la ultima copia, para poder mostrarlo y que no falle en silencio. */
export async function estadoRespaldo(): Promise<EstadoRespaldo> {
  if (!respaldoConfigurado()) {
    return { configurado: false, fecha: null, tamano: null, url: null };
  }

  try {
    const { blobs } = await list({ prefix: NOMBRE, limit: 1 });
    const copia = blobs[0];
    return {
      configurado: true,
      fecha: copia ? new Date(copia.uploadedAt).toISOString() : null,
      tamano: copia?.size ?? null,
      url: copia?.downloadUrl ?? null,
    };
  } catch {
    return { configurado: true, fecha: null, tamano: null, url: null };
  }
}

/**
 * Genera el CSV y lo guarda pisando la copia anterior. Nunca lanza: un
 * problema guardando el respaldo no puede romper la operacion que lo
 * disparo (crear un lote, cambiar un destino).
 */
export async function respaldar(supabase: SupabaseClient): Promise<{ ok: boolean; error?: string }> {
  if (!respaldoConfigurado()) return { ok: false, error: "sin configurar" };

  try {
    const codes = await fetchQrCodes(supabase, { from: null, to: null }, MAX_FILAS);
    if (codes.length === 0) return { ok: true };

    const csv = exportCsv(codes, siteUrl(), await designNames(supabase));

    await put(NOMBRE, csv, {
      access: "public",
      contentType: "text/csv; charset=utf-8",
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
