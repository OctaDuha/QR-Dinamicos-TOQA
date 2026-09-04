import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_LAYOUT, normalizeLayout, type PlacaLayout } from "./placa";

export type PlacaSettings = {
  layout: PlacaLayout;
  backgroundName: string | null;
  backgroundPdf: Buffer | null;
};

export async function loadPlacaSettings(
  supabase: SupabaseClient,
  withBackground: boolean,
): Promise<PlacaSettings> {
  const columns = withBackground
    ? "layout, background_name, background_pdf"
    : "layout, background_name";

  const { data } = await supabase
    .from("placa_settings")
    .select(columns)
    .eq("id", 1)
    .maybeSingle<{ layout: unknown; background_name: string | null; background_pdf?: string | null }>();

  return {
    layout: data ? normalizeLayout(data.layout) : DEFAULT_LAYOUT,
    backgroundName: data?.background_name ?? null,
    backgroundPdf: data?.background_pdf ? Buffer.from(data.background_pdf, "base64") : null,
  };
}
