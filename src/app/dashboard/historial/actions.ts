"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { faltaMigracion } from "@/lib/historial";
import { parseQrId } from "@/lib/qr";
import { respaldarDespues } from "@/lib/respaldo-auto";
import { sesionActual } from "@/lib/roles";

/**
 * Devuelve placas de la papelera. Quien decide si se puede es la base (solo
 * el dueño, solo dentro de los 30 días, y nunca pisando una placa que ya use
 * ese número); acá solo se traduce la respuesta.
 */
export async function recuperarPlacas(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ids = String(formData.get("ids") ?? "")
    .split(",")
    .map((parte) => parseQrId(parte))
    .filter((id): id is number => id !== null);

  if (ids.length === 0) return { ok: false, message: "No hay ninguna placa para recuperar." };

  const sesion = await sesionActual();
  if (!sesion) return { ok: false, message: "Tu sesión se cerró. Volvé a entrar y probá de nuevo." };
  if (sesion.rol !== "dueno") return { ok: false, message: "Solo el dueño puede recuperar placas." };

  const { data, error } = await sesion.supabase.rpc("recuperar_placas", { p_ids: ids });
  if (error) {
    return {
      ok: false,
      message: faltaMigracion(error)
        ? "Para recuperar falta correr en Supabase el archivo 2026-10-papelera.sql."
        : `No pude recuperar: ${error.message}`,
    };
  }

  const filas = (data ?? []) as { qr_id: number; resultado: "ok" | "en-uso" | "no-esta" }[];
  const de = (resultado: string) => filas.filter((f) => f.resultado === resultado).map((f) => f.qr_id);
  const ok = de("ok");

  if (ok.length > 0) {
    respaldarDespues(sesion.supabase);
    revalidatePath("/dashboard");
  }

  // El aviso viaja en la dirección: la placa recuperada sale de la papelera
  // y el botón que la recuperó desaparece con ella.
  const params = new URLSearchParams();
  if (ok.length) params.set("recuperadas", ok.join(","));
  if (de("en-uso").length) params.set("en-uso", de("en-uso").join(","));
  if (de("no-esta").length) params.set("no-esta", de("no-esta").join(","));
  redirect(`/dashboard/historial?${params.toString()}`);
}
