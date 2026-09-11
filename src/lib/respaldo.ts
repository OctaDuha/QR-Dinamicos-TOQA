import type { SupabaseClient } from "@supabase/supabase-js";
import { get, list, put } from "@vercel/blob";

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

/**
 * La clave del almacen.
 *
 * Vercel la llama BLOB_READ_WRITE_TOKEN por defecto, pero al conectar el
 * almacen deja elegir un prefijo, y ahi pasa a llamarse MIALMACEN_READ_
 * WRITE_TOKEN o parecido. Buscamos la de siempre y, si no esta, cualquier
 * otra que termine igual y tenga pinta de clave de Blob: asi funciona sin
 * que haya que adivinar como quedo nombrada.
 */
export function tokenRespaldo(): string | null {
  const directa = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (directa) return directa;

  for (const [nombre, valor] of Object.entries(process.env)) {
    if (nombre.endsWith("_READ_WRITE_TOKEN") && valor?.trim().startsWith("vercel_blob_rw_")) {
      return valor.trim();
    }
  }

  return null;
}

export function respaldoConfigurado(): boolean {
  return tokenRespaldo() !== null;
}

export type EstadoRespaldo = {
  configurado: boolean;
  fecha: string | null;
  tamano: number | null;
  url: string | null;
  /** Nombres (no valores) de las claves de almacen que se ven, para diagnosticar. */
  clavesVisibles: string[];
  error: string | null;
};

/** Solo los nombres: sirve para saber si Vercel la nombro distinto. */
function clavesVisibles(): string[] {
  return Object.keys(process.env).filter((n) => n.endsWith("_READ_WRITE_TOKEN"));
}

/** Cuando se guardo la ultima copia, para poder mostrarlo y que no falle en silencio. */
export async function estadoRespaldo(): Promise<EstadoRespaldo> {
  if (!respaldoConfigurado()) {
    return {
      configurado: false,
      fecha: null,
      tamano: null,
      url: null,
      clavesVisibles: clavesVisibles(),
      error: null,
    };
  }

  try {
    const { blobs } = await list({ prefix: NOMBRE, limit: 1, token: tokenRespaldo() ?? undefined });
    const copia = blobs[0];
    return {
      configurado: true,
      fecha: copia ? new Date(copia.uploadedAt).toISOString() : null,
      tamano: copia?.size ?? null,
      url: copia ? "/api/respaldo/descargar" : null,
      clavesVisibles: clavesVisibles(),
      error: null,
    };
  } catch (error) {
    return {
      configurado: true,
      fecha: null,
      tamano: null,
      url: null,
      clavesVisibles: clavesVisibles(),
      error: (error as Error).message,
    };
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

    // Privado a proposito: la planilla lleva los nombres de los clientes y
    // a donde apunta cada placa. Se baja desde el panel, con sesion.
    await put(NOMBRE, csv, {
      access: "private",
      contentType: "text/csv; charset=utf-8",
      addRandomSuffix: false,
      allowOverwrite: true,
      token: tokenRespaldo() ?? undefined,
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/** Contenido de la ultima copia, para poder bajarla desde el panel. */
export async function leerRespaldo(): Promise<string | null> {
  const token = tokenRespaldo();
  if (!token) return null;

  try {
    const resultado = await get(NOMBRE, { access: "private", token });
    if (!resultado || resultado.statusCode !== 200) return null;
    return await new Response(resultado.stream).text();
  } catch {
    return null;
  }
}
