import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { normalizeLayout, renderPlacas } from "@/lib/placa";
import { loadPlacaSettings } from "@/lib/placa-settings";
import { parseQrId, siteUrl } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Previsualiza UNA placa con la posicion que venga por querystring, sin
 * guardar nada. Es el PDF real que sale a imprenta, no una aproximacion.
 */
export async function GET(request: NextRequest) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const url = new URL(request.url);
  const settings = await loadPlacaSettings(supabase, true);

  const layout = normalizeLayout({
    ...settings.layout,
    ...numeric(url, ["qrPage", "xMm", "yMm", "sizeMm", "quietModules"]),
    ...(url.searchParams.has("whiteBackdrop")
      ? { whiteBackdrop: url.searchParams.get("whiteBackdrop") === "true" }
      : {}),
  });

  const id = parseQrId(url.searchParams.get("id") ?? "1") ?? 1;

  const pdf = await renderPlacas({
    ids: [id],
    backgroundPdf: settings.backgroundPdf,
    layout,
    baseUrl: siteUrl(),
  });

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=\"preview.pdf\"",
      "Cache-Control": "no-store",
    },
  });
}

function numeric(url: URL, keys: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of keys) {
    const raw = url.searchParams.get(key);
    if (raw !== null && raw !== "" && Number.isFinite(Number(raw))) {
      out[key] = Number(raw);
    }
  }
  return out;
}
