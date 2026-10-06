"use server";

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
