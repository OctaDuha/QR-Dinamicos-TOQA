import type { SupabaseClient } from "@supabase/supabase-js";

import { formatQrCode } from "./qr";

/** Cuánto aguanta una placa borrada antes de eliminarse para siempre. */
export const DIAS_PAPELERA = 30;
const DIA = 86_400_000;

export type EnPapelera = {
  qr_id: number;
  label: string | null;
  destination_url: string;
  diseno_nombre: string | null;
  borrado_en: string;
  borrado_por_email: string | null;
  escaneos: number;
};

/**
 * Lo que hay en la papelera, del más nuevo al más viejo. De paso vacía lo
 * vencido; si eso falla no importa, lo vencido igual no se muestra.
 */
export async function leerPapelera(
  supabase: SupabaseClient,
): Promise<{ data: EnPapelera[]; error: { code?: string; message: string } | null }> {
  await supabase.rpc("vaciar_papelera");

  const { data, error } = await supabase
    .from("papelera")
    .select("qr_id, label, destination_url, diseno_nombre, borrado_en, borrado_por_email, papelera_escaneos(count)")
    .gte("borrado_en", new Date(Date.now() - DIAS_PAPELERA * DIA).toISOString())
    .order("borrado_en", { ascending: false })
    .order("qr_id", { ascending: true })
    .limit(1000);

  if (error) return { data: [], error };

  return {
    data: (data ?? []).map((fila) => {
      const { papelera_escaneos, ...resto } = fila as Omit<EnPapelera, "escaneos"> & {
        papelera_escaneos: { count: number }[] | null;
      };
      return { ...resto, escaneos: papelera_escaneos?.[0]?.count ?? 0 };
    }),
    error: null,
  };
}

const FECHA = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** "se elimina el 03/11/2026 (en 30 días)" */
export function vencimiento(borradoEn: string): string {
  const vence = Date.parse(borradoEn) + DIAS_PAPELERA * DIA;
  const dias = Math.max(0, Math.ceil((vence - Date.now()) / DIA));
  const cuanto = dias <= 1 ? "en menos de un día" : `en ${dias} días`;
  return `Se elimina para siempre el ${FECHA.format(new Date(vence))} (${cuanto})`;
}

/** Las que se borraron juntas comparten el instante exacto con su renglón del historial. */
export function borradasEn(papelera: EnPapelera[], instante: string): number[] {
  const t = Date.parse(instante);
  return papelera.filter((p) => Date.parse(p.borrado_en) === t).map((p) => p.qr_id);
}

/** "0044", "0044 y 0045", "0043, 0044 y 3 más" */
export function listaDeNumeros(ids: number[]): string {
  const numeros = ids.map(formatQrCode);
  if (numeros.length <= 2) return numeros.join(" y ");
  if (numeros.length <= 4) return `${numeros.slice(0, -1).join(", ")} y ${numeros.at(-1)}`;
  return `${numeros.slice(0, 3).join(", ")} y ${numeros.length - 3} más`;
}
