"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { LARGO_MAXIMO, TEXTOS } from "@/lib/bot-textos";
import { sesionActual } from "@/lib/roles";

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
