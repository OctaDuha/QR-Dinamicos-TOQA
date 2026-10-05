import type { SupabaseClient } from "@supabase/supabase-js";

import type { QrCode } from "./types";

export type RangeFilter = { from: number | null; to: number | null };

export function readRange(url: URL): RangeFilter {
  const parse = (value: string | null) => {
    const n = Number(value);
    return value && Number.isInteger(n) && n > 0 ? n : null;
  };
  return { from: parse(url.searchParams.get("from")), to: parse(url.searchParams.get("to")) };
}

/** Trae los QR paginando de a 1000 (limite por request de PostgREST). */
export async function fetchQrCodes(
  supabase: SupabaseClient,
  range: RangeFilter,
  max: number,
): Promise<QrCode[]> {
  const codes: QrCode[] = [];
  const pageSize = 1000;

  for (let offset = 0; offset < max; offset += pageSize) {
    let query = supabase
      .from("qr_codes")
      .select("id, label, destination_url, created_at, design_id")
      .order("id", { ascending: true })
      .range(offset, Math.min(offset + pageSize, max) - 1);

    if (range.from !== null) query = query.gte("id", range.from);
    if (range.to !== null) query = query.lte("id", range.to);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const page = (data ?? []) as QrCode[];
    codes.push(...page);
    if (page.length < pageSize) break;
  }

  return codes;
}

/**
 * El cliente de cada placa, por número. Va aparte de fetchQrCodes a
 * propósito: sin la migración de clientes la columna no existe, y la copia
 * de seguridad tiene que salir igual (con la columna vacía).
 */
export async function nombresDeClientes(supabase: SupabaseClient): Promise<Map<number, string>> {
  const nombres = new Map<number, string>();
  const pageSize = 1000;

  for (let offset = 0; offset < 100_000; offset += pageSize) {
    const { data, error } = await supabase
      .from("qr_codes_with_stats")
      .select("id, cliente_nombre")
      .not("cliente_id", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) return nombres;

    const page = (data ?? []) as { id: number; cliente_nombre: string | null }[];
    for (const fila of page) if (fila.cliente_nombre) nombres.set(fila.id, fila.cliente_nombre);
    if (page.length < pageSize) break;
  }

  return nombres;
}
