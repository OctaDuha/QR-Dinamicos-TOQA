import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";

import { formatQrCode } from "./qr";

/**
 * Historial de las placas: quién hizo qué y cuándo.
 *
 * Lo escribe la base sola (migración 2026-10-historial.sql), así que
 * acá solo se lee y se traduce a castellano. La única excepción son las
 * impresiones, que no pasan por la tabla de QRs: esas las anota el panel al
 * generar el PDF, y quién imprimió lo pone la base, no el que llama.
 */

type Cambio = { antes?: string | null; despues?: string | null };

export type FilaHistorial = {
  id: number;
  qr_id: number | null;
  accion: "creo" | "edito" | "borro" | "imprimio" | "recupero";
  cambios: Partial<Record<"destino" | "etiqueta" | "diseno" | "cliente", Cambio>>;
  detalle: { diseno?: string; formato?: string };
  usuario_email: string | null;
  creado_en: string;
};

export type GrupoHistorial = {
  accion: FilaHistorial["accion"];
  usuario_email: string | null;
  creado_en: string;
  cantidad: number;
  desde_qr: number | null;
  hasta_qr: number | null;
  cambios: FilaHistorial["cambios"] | null;
  campos: string[] | null;
  disenos: string[] | null;
  formato: string | null;
};

/** Sin la migración, la tabla no existe: se avisa en vez de romper. */
export function faltaMigracion(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST202";
}

export function quien(email: string | null): string {
  return email ?? "Sistema";
}

const FECHA = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Siempre en hora de Argentina: el servidor corre en otra zona horaria. */
export function cuando(iso: string): string {
  return FECHA.format(new Date(iso));
}

const comillas = (texto: string) => `"${texto}"`;

function describirCambios(cambios: FilaHistorial["cambios"]): string[] {
  const lineas: string[] = [];
  const { destino, etiqueta, diseno, cliente } = cambios;

  if (destino) {
    if (destino.antes && destino.despues) lineas.push(`Cambió el destino: de ${destino.antes} a ${destino.despues}`);
    else if (destino.despues) lineas.push(`Destino: ${destino.despues}`);
  }
  if (etiqueta) {
    if (etiqueta.antes && etiqueta.despues) {
      lineas.push(`Cambió la etiqueta: de ${comillas(etiqueta.antes)} a ${comillas(etiqueta.despues)}`);
    } else if (etiqueta.despues) lineas.push(`Le puso la etiqueta ${comillas(etiqueta.despues)}`);
    else if (etiqueta.antes) lineas.push(`Le sacó la etiqueta ${comillas(etiqueta.antes)}`);
  }
  if (diseno) {
    if (diseno.antes && diseno.despues) {
      lineas.push(`Cambió el diseño: de ${comillas(diseno.antes)} a ${comillas(diseno.despues)}`);
    } else if (diseno.despues) lineas.push(`Le asignó el diseño ${comillas(diseno.despues)}`);
    else if (diseno.antes) lineas.push(`Le quitó el diseño (${diseno.antes})`);
    else lineas.push("Le quitó el diseño");
  }
  if (cliente) {
    if (cliente.antes && cliente.despues) {
      lineas.push(`Cambió el cliente: de ${comillas(cliente.antes)} a ${comillas(cliente.despues)}`);
    } else if (cliente.despues) lineas.push(`La asignó al cliente ${comillas(cliente.despues)}`);
    else if (cliente.antes) lineas.push(`La sacó del cliente ${comillas(cliente.antes)}`);
  }
  return lineas;
}

/**
 * Un renglón del historial de una placa, en palabras: título y detalles.
 * Con número ("la placa 0042") para la lista general, donde hay de todas.
 */
export function describirFila(fila: FilaHistorial, numero?: string): { titulo: string; detalles: string[] } {
  const placa = numero ? `la placa ${numero}` : "la placa";
  switch (fila.accion) {
    case "creo":
      return { titulo: `Creó ${placa}`, detalles: describirCambios(fila.cambios) };
    case "edito":
      return { titulo: `Editó ${placa}`, detalles: describirCambios(fila.cambios) };
    case "borro":
      return {
        titulo: `Borró ${placa}`,
        detalles: fila.cambios.destino?.antes ? [`Llevaba a ${fila.cambios.destino.antes}`] : [],
      };
    case "recupero":
      return { titulo: `Recuperó ${placa} de la papelera`, detalles: ["Volvió con sus estadísticas"] };
    case "imprimio":
      return {
        titulo: `Generó ${placa} para imprenta`,
        detalles: [
          fila.detalle.diseno ? `Diseño ${comillas(fila.detalle.diseno)}` : "",
          fila.detalle.formato === "zip" ? "Un PDF por placa (ZIP)" : "",
        ].filter(Boolean),
      };
  }
}

/**
 * Crear con etiqueta son dos pasos para la base (se crea la placa y después
 * se le pone la etiqueta, que lleva su número), así que quedan dos renglones
 * pegados. Para leer, se juntan: "Creó la placa" con su etiqueta.
 */
export function juntarAltas(filas: FilaHistorial[]): FilaHistorial[] {
  const resultado: FilaHistorial[] = [];
  for (const fila of filas) {
    const anterior = resultado[resultado.length - 1];
    // filas va de la más nueva a la más vieja: la alta es la que sigue.
    if (
      anterior &&
      anterior.accion === "edito" &&
      fila.accion === "creo" &&
      esSoloEtiquetaNueva(anterior.cambios) &&
      anterior.usuario_email === fila.usuario_email &&
      Math.abs(Date.parse(anterior.creado_en) - Date.parse(fila.creado_en)) < 60_000
    ) {
      resultado[resultado.length - 1] = { ...fila, cambios: { ...fila.cambios, etiqueta: anterior.cambios.etiqueta } };
      continue;
    }
    resultado.push(fila);
  }
  return resultado;
}

function esSoloEtiquetaNueva(cambios: FilaHistorial["cambios"]): boolean {
  const claves = Object.keys(cambios);
  return claves.length === 1 && claves[0] === "etiqueta" && !cambios.etiqueta?.antes;
}

/** Lo mismo que juntarAltas, para la lista general: "Creó 20 placas" con su etiqueta. */
export function juntarAltasGrupos(grupos: GrupoHistorial[]): (GrupoHistorial & { conEtiqueta?: boolean })[] {
  const resultado: (GrupoHistorial & { conEtiqueta?: boolean })[] = [];
  for (const grupo of grupos) {
    const anterior = resultado[resultado.length - 1];
    if (
      anterior &&
      anterior.accion === "edito" &&
      grupo.accion === "creo" &&
      anterior.campos?.length === 1 &&
      anterior.campos[0] === "etiqueta" &&
      (Number(anterior.cantidad) > 1 || !anterior.cambios?.etiqueta?.antes) &&
      Number(anterior.cantidad) === Number(grupo.cantidad) &&
      anterior.desde_qr === grupo.desde_qr &&
      anterior.hasta_qr === grupo.hasta_qr &&
      anterior.usuario_email === grupo.usuario_email &&
      Math.abs(Date.parse(anterior.creado_en) - Date.parse(grupo.creado_en)) < 60_000
    ) {
      resultado[resultado.length - 1] = {
        ...grupo,
        cambios: grupo.cambios ? { ...grupo.cambios, etiqueta: anterior.cambios?.etiqueta } : null,
        conEtiqueta: true,
      };
      continue;
    }
    resultado.push(grupo);
  }
  return resultado;
}

function rango(grupo: GrupoHistorial): string {
  if (grupo.desde_qr === null || grupo.hasta_qr === null) return "";
  const desde = formatQrCode(grupo.desde_qr);
  const hasta = formatQrCode(grupo.hasta_qr);
  if (grupo.desde_qr === grupo.hasta_qr) return `la ${desde}`;
  return grupo.hasta_qr - grupo.desde_qr + 1 === grupo.cantidad
    ? `de la ${desde} a la ${hasta}`
    : `entre la ${desde} y la ${hasta}`;
}

const NOMBRE_CAMPO: Record<string, string> = {
  destino: "el destino",
  etiqueta: "la etiqueta",
  diseno: "el diseño",
  cliente: "el cliente",
};

/** Un renglón de la lista general, que puede abarcar varias placas. */
export function describirGrupo(grupo: GrupoHistorial & { conEtiqueta?: boolean }): {
  titulo: string;
  detalles: string[];
} {
  const n = Number(grupo.cantidad);

  if (n === 1) {
    const fila: FilaHistorial = {
      id: 0,
      qr_id: grupo.desde_qr,
      accion: grupo.accion,
      cambios: grupo.cambios ?? {},
      detalle: { diseno: grupo.disenos?.[0], formato: grupo.formato ?? undefined },
      usuario_email: grupo.usuario_email,
      creado_en: grupo.creado_en,
    };
    return describirFila(fila, grupo.desde_qr !== null ? formatQrCode(grupo.desde_qr) : undefined);
  }

  const placas = `${n} placas (${rango(grupo)})`;
  switch (grupo.accion) {
    case "creo":
      return { titulo: `Creó ${placas}`, detalles: grupo.conEtiqueta ? ["Con etiqueta"] : [] };
    case "borro":
      return { titulo: `Borró ${placas}`, detalles: [] };
    case "recupero":
      return { titulo: `Recuperó ${placas} de la papelera`, detalles: ["Volvieron con sus estadísticas"] };
    case "imprimio": {
      const disenos = grupo.disenos ?? [];
      return {
        titulo: `Generó ${placas} para imprenta`,
        detalles: [
          disenos.length === 1 ? `Diseño ${comillas(disenos[0])}` : disenos.length > 1 ? "Con varios diseños" : "",
          grupo.formato === "zip" ? "Un PDF por placa (ZIP)" : "",
        ].filter(Boolean),
      };
    }
    case "edito": {
      const campos = (grupo.campos ?? []).map((c) => NOMBRE_CAMPO[c] ?? c);
      const lista = campos.length > 1 ? `${campos.slice(0, -1).join(", ")} y ${campos.at(-1)}` : campos[0] ?? "algo";
      return { titulo: `Cambió ${lista} de ${placas}`, detalles: [] };
    }
  }
}

/** Las impresiones: se anotan después de responder, y si fallan no frenan nada. */
export function anotarImpresion(
  supabase: SupabaseClient,
  items: { qrId: number; design: { name: string } }[],
  formato: "pdf" | "zip",
): void {
  after(async () => {
    const { error } = await supabase.rpc("registrar_impresion", {
      p_ids: items.map((item) => item.qrId),
      p_disenos: items.map((item) => item.design.name),
      p_formato: formato,
    });
    if (error && !faltaMigracion(error)) {
      console.error("[historial] no se pudo anotar la impresión:", error.message);
    }
  });
}
