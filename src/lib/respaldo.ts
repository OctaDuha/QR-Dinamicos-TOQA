import type { SupabaseClient } from "@supabase/supabase-js";
import { get, list, put } from "@vercel/blob";
import { after } from "next/server";

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
const CARPETA_DIARIA = "respaldos/dia/";
const MARCA_DESCARGA = "respaldos/ultima-descarga.txt";
const MAX_FILAS = 20000;

const hoy = () => new Date().toISOString().slice(0, 10);

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
    const limpio = valor?.trim();
    if (!limpio) continue;
    const suenaAClave = nombre.endsWith("_READ_WRITE_TOKEN") || nombre.includes("BLOB");
    if (suenaAClave && limpio.startsWith("vercel_blob_rw_")) return limpio;
  }

  return null;
}

/**
 * Vercel ya no inyecta una clave de lectura/escritura al conectar un Blob
 * store: agrega BLOB_STORE_ID y el cliente se autentica solo contra la
 * plataforma. Las claves sueltas siguen existiendo para usarlas desde
 * afuera, asi que valen las dos formas.
 */
export function almacenDeclarado(): boolean {
  return Boolean(process.env.BLOB_STORE_ID?.trim());
}

export function respaldoConfigurado(): boolean {
  return tokenRespaldo() !== null || almacenDeclarado();
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

/**
 * Solo los nombres, nunca los valores: sirve para saber si Vercel la nombro
 * distinto de lo esperado. Se mira cualquier cosa que suene a Blob, no solo
 * el sufijo habitual, para que el diagnostico no se quede corto.
 */
function clavesVisibles(): string[] {
  return Object.keys(process.env).filter(
    (n) => n.endsWith("_READ_WRITE_TOKEN") || n.includes("BLOB"),
  );
}

/** Opciones de acceso al almacen: la clave solo si la hay. */
function acceso(): { token?: string } {
  const token = tokenRespaldo();
  return token ? { token } : {};
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
    const { blobs } = await list({ prefix: NOMBRE, limit: 1, ...acceso() });
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
export async function respaldar(
  supabase: SupabaseClient,
): Promise<{ ok: boolean; error?: string; errorFoto?: string }> {
  if (!respaldoConfigurado()) return { ok: false, error: "sin configurar" };


  try {
    const codes = await fetchQrCodes(supabase, { from: null, to: null }, MAX_FILAS);
    if (codes.length === 0) return { ok: true };

    const csv = exportCsv(codes, siteUrl(), await designNames(supabase));
    const acceso_ = acceso();

    // Privado a proposito: la planilla lleva los nombres de los clientes y
    // a donde apunta cada placa. Se baja desde el panel, con sesion.
    await put(NOMBRE, csv, {
      access: "private",
      contentType: "text/csv; charset=utf-8",
      addRandomSuffix: false,
      allowOverwrite: true,
      ...acceso_,
    });

    // Y una foto por dia, que no se pisa.
    //
    // La copia de arriba sola no alcanzaba: si alguien entrara al panel y
    // cambiara todos los destinos, ese mismo cambio dispararia el respaldo y
    // reemplazaria la copia buena por la envenenada. Guardando la primera
    // foto de cada dia, siempre queda a que volver.
    // En su propio try: la copia principal ya esta guardada, y si la foto
    // fallara (dos cambios a la vez, por ejemplo) no tiene por que hacer
    // parecer que fallo todo el respaldo.
    const delDia = `${CARPETA_DIARIA}${hoy()}.csv`;
    try {
      const { blobs } = await list({ prefix: delDia, limit: 1, ...acceso_ });

      if (blobs.length === 0) {
        await put(delDia, csv, {
          access: "private",
          contentType: "text/csv; charset=utf-8",
          addRandomSuffix: false,
          allowOverwrite: true,
          ...acceso_,
        });
      }
    } catch (error) {
      console.error("[respaldo] no se pudo guardar la foto del dia:", (error as Error).message);
      return { ok: true, errorFoto: (error as Error).message };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/** Contenido de la ultima copia, para poder bajarla desde el panel. */
export async function leerRespaldo(): Promise<string | null> {
  if (!respaldoConfigurado()) return null;

  try {
    const resultado = await get(NOMBRE, { access: "private", ...acceso() });
    if (!resultado || resultado.statusCode !== 200) return null;
    return await new Response(resultado.stream).text();
  } catch {
    return null;
  }
}

export type FotoDiaria = { fecha: string; tamano: number };

/** Las fotos por dia que hay guardadas, de la mas nueva a la mas vieja. */
export async function fotosDiarias(): Promise<FotoDiaria[]> {
  if (!respaldoConfigurado()) return [];

  try {
    const { blobs } = await list({ prefix: CARPETA_DIARIA, limit: 400, ...acceso() });
    return blobs
      .map((b) => ({ fecha: b.pathname.slice(CARPETA_DIARIA.length, -4), tamano: b.size }))
      .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f.fecha))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  } catch {
    return [];
  }
}

/** Una foto puntual, para poder volver a un dia anterior. */
export async function leerFotoDiaria(fecha: string): Promise<string | null> {
  if (!respaldoConfigurado() || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;

  try {
    const resultado = await get(`${CARPETA_DIARIA}${fecha}.csv`, { access: "private", ...acceso() });
    if (!resultado || resultado.statusCode !== 200) return null;
    return await new Response(resultado.stream).text();
  } catch {
    return null;
  }
}

/**
 * La copia que vive afuera.
 *
 * Todo lo de arriba vive adentro de Vercel: cubre perder la base y cubre
 * que alguien toque los destinos, pero no cubre perder la cuenta de Vercel,
 * porque se va con ella. Lo unico que cubre eso es un CSV bajado a una
 * computadora, y eso no se puede automatizar: nadie puede dejarte un
 * archivo en el disco desde afuera.
 *
 * Asi que al menos se anota cuando fue la ultima vez, para que el panel
 * pueda avisar cuando pasaron demasiados dias. Se guarda como un archivo
 * vacio mas en el mismo almacen: no hace falta tocar la base de datos, y
 * la fecha que interesa es la que el almacen ya registra sola.
 */
export function anotarDescarga(): void {
  if (!respaldoConfigurado()) return;

  after(async () => {
    try {
      await put(MARCA_DESCARGA, new Date().toISOString(), {
        access: "private",
        contentType: "text/plain; charset=utf-8",
        addRandomSuffix: false,
        allowOverwrite: true,
        ...acceso(),
      });
    } catch (error) {
      console.error("[respaldo] no se pudo anotar la descarga:", (error as Error).message);
    }
  });
}

/** Cuando se bajo una copia por ultima vez, o null si nunca. */
export async function ultimaDescarga(): Promise<string | null> {
  if (!respaldoConfigurado()) return null;

  try {
    const { blobs } = await list({ prefix: MARCA_DESCARGA, limit: 1, ...acceso() });
    return blobs[0] ? new Date(blobs[0].uploadedAt).toISOString() : null;
  } catch {
    return null;
  }
}
