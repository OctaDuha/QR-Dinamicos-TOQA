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
