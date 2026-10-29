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

/** Nombres de todos los diseños, para las planillas de exportacion. */
export async function designNames(supabase: SupabaseClient): Promise<Map<number, string>> {
  const { data } = await supabase.from("placa_designs").select("id, name");
  return new Map((data ?? []).map((row) => [(row as { id: number }).id, (row as { name: string }).name]));
}

/** Sin tildes, en minúsculas y con las medidas juntas: "10 × 10" → "10x10". */
function paraBuscar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)/g, "$1x$2")
    .replace(/,/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Los diseños que coinciden con lo que se escribió en el buscador de QRs:
 * cada palabra tiene que aparecer en el nombre o en la medida, en cualquier
 * orden. Así "google 10x10" encuentra "Google Reseñas VINILO 10x10", y
 * "10x15" encuentra las placas de esa medida aunque el nombre no la diga.
 */
export function disenosQueCoinciden(
  designs: Pick<DesignSummary, "id" | "name" | "page_width_mm" | "page_height_mm">[],
  busqueda: string,
): number[] {
  const palabras = paraBuscar(busqueda).split(" ").filter(Boolean);
  if (palabras.length === 0) return [];

  return designs
    .filter((d) => {
      const medidas =
        d.page_width_mm && d.page_height_mm
          ? `${+(d.page_width_mm / 10).toFixed(1)}x${+(d.page_height_mm / 10).toFixed(1)} ` +
            `${Math.round(d.page_width_mm)}x${Math.round(d.page_height_mm)}`
          : "";
      const texto = paraBuscar(`${d.name} ${medidas}`);
      return palabras.every((palabra) => texto.includes(palabra));
    })
    .map((d) => d.id);
}
