import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_LAYOUT, normalizeLayout, type LoadedDesign } from "./placa";

export type DesignSummary = {
  id: number;
  name: string;
  background_name: string | null;
  page_width_mm: number | null;
  page_height_mm: number | null;
  page_count: number | null;
  layout: ReturnType<typeof normalizeLayout>;
  created_at: string;
};

const SUMMARY_COLUMNS =
  "id, name, background_name, page_width_mm, page_height_mm, page_count, layout, created_at";

export async function listDesigns(supabase: SupabaseClient): Promise<DesignSummary[]> {
  const { data } = await supabase
    .from("placa_designs")
    .select(SUMMARY_COLUMNS)
    .order("id", { ascending: true });

  return (data ?? []).map((row) => ({
    ...(row as unknown as DesignSummary),
    layout: normalizeLayout((row as { layout: unknown }).layout),
  }));
}

/** Trae el diseno con su PDF de fondo, listo para generar. */
export async function loadDesign(
  supabase: SupabaseClient,
  id: number,
): Promise<LoadedDesign | null> {
  const { data } = await supabase
    .from("placa_designs")
    .select("id, name, layout, background_pdf")
    .eq("id", id)
    .maybeSingle<{ id: number; name: string; layout: unknown; background_pdf: string | null }>();

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    layout: normalizeLayout(data.layout),
    backgroundPdf: data.background_pdf ? Buffer.from(data.background_pdf, "base64") : null,
  };
}

/** Varios diseños de una, sin repetir descargas de un mismo fondo. */
export async function loadDesigns(
  supabase: SupabaseClient,
  ids: number[],
): Promise<Map<number, LoadedDesign>> {
  const unique = [...new Set(ids)];
  const map = new Map<number, LoadedDesign>();
  if (unique.length === 0) return map;

  const { data } = await supabase
    .from("placa_designs")
    .select("id, name, layout, background_pdf")
    .in("id", unique);

  for (const row of data ?? []) {
    const design = row as { id: number; name: string; layout: unknown; background_pdf: string | null };
    map.set(design.id, {
      id: design.id,
      name: design.name,
      layout: normalizeLayout(design.layout),
      backgroundPdf: design.background_pdf ? Buffer.from(design.background_pdf, "base64") : null,
    });
  }

  return map;
}

export const FALLBACK_DESIGN: LoadedDesign = {
  id: 0,
  name: "Sin diseño",
  layout: DEFAULT_LAYOUT,
  backgroundPdf: null,
};
