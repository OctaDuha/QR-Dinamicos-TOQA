"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { LARGO_MAXIMO, TEXTOS } from "@/lib/bot-textos";
import { sesionActual } from "@/lib/roles";
import { conectarCuenta } from "@/lib/whatsapp";

/**
 * Genera la llave del bot. Se muestra una sola vez: la base guarda solo su
 * huella. La anterior deja de servir en el acto.
 */
export async function generarLlave(): Promise<{ llave?: string; error?: string }> {
  const sesion = await sesionActual();
  if (!sesion) return { error: "Tu sesión se cerró. Volvé a entrar y probá de nuevo." };
  if (sesion.rol !== "dueno") return { error: "Solo el dueño puede generar la llave del bot." };

  const { data, error } = await sesion.supabase.rpc("bot_generar_llave");
  if (error) {
    return {
      error:
        error.code === "PGRST202"
          ? "Falta correr en Supabase el archivo 2026-10-bot-whatsapp.sql."
          : `No pude generarla: ${error.message}`,
    };
  }
  return { llave: data as string };
}

/**
 * Guarda los textos del bot. Uno que queda igual al de siempre (o vacío) se
 * borra de la base: así, si algún día cambia el texto de siempre, le llega.
 */
export async function guardarTextos(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const sesion = await sesionActual();
  if (!sesion) return { ok: false, message: "Tu sesión se cerró. Volvé a entrar y probá de nuevo." };
  if (sesion.rol !== "dueno") return { ok: false, message: "Solo el dueño puede cambiar los textos del bot." };

  // El navegador manda los saltos de línea de un textarea como \r\n: se
  // emparejan para poder comparar con el texto de siempre.
  const campos = Object.fromEntries(
    TEXTOS.map(({ clave }) => [clave, String(formData.get(clave) ?? "").replace(/\r\n?/g, "\n")]),
  );
  const largo = TEXTOS.find(({ clave }) => campos[clave].trim().length > LARGO_MAXIMO);
  if (largo) {
    return { ok: false, message: `"${largo.titulo}" es muy largo: hasta ${LARGO_MAXIMO} letras.`, campos };
  }

  const guardar = TEXTOS.filter(({ clave, porDefecto }) => campos[clave].trim() && campos[clave].trim() !== porDefecto);
  const borrar = TEXTOS.filter(({ clave }) => !guardar.some((g) => g.clave === clave)).map(({ clave }) => clave);

  if (guardar.length > 0) {
    const { error } = await sesion.supabase.from("bot_textos").upsert(
      guardar.map(({ clave }) => ({ clave, texto: campos[clave].trim(), actualizado_en: new Date().toISOString() })),
    );
    if (error) return { ok: false, message: `No pude guardar: ${error.message}`, campos };
  }
  if (borrar.length > 0) {
    const { error } = await sesion.supabase.from("bot_textos").delete().in("clave", borrar);
    if (error) return { ok: false, message: `No pude guardar: ${error.message}`, campos };
  }

  revalidatePath("/dashboard/whatsapp");
  return { ok: true, message: "Textos guardados. El bot ya usa los nuevos." };
}

export type Conexion =
  | { ok: true; phoneId: string; wabaId: string; numero: string; nombre: string }
  | { ok: false; error: string };

/**
 * Termina la conexión del WhatsApp Business del celular, después de la
 * ventanita de Meta. No guarda nada: devuelve los datos para cargar en Vercel.
 */
export async function conectarWhatsapp(datos: { codigo: string; wabaId: string; phoneId: string }): Promise<Conexion> {
  const sesion = await sesionActual();
  if (!sesion) return { ok: false, error: "Tu sesión se cerró. Volvé a entrar y probá de nuevo." };
  if (sesion.rol !== "dueno") return { ok: false, error: "Solo el dueño puede conectar el WhatsApp del bot." };

  const codigo = String(datos.codigo ?? "").trim();
  const wabaId = String(datos.wabaId ?? "").trim();
  const phoneId = String(datos.phoneId ?? "").trim();
  if (!codigo || !/^\d{5,25}$/.test(wabaId) || !/^\d{5,25}$/.test(phoneId)) {
    return { ok: false, error: "Meta no mandó los datos de la cuenta. Probá de nuevo." };
  }

  const resultado = await conectarCuenta(codigo, wabaId, phoneId);
  if (!resultado.ok) return resultado;
  return { ok: true, phoneId, wabaId, numero: resultado.numero, nombre: resultado.nombre };
}
