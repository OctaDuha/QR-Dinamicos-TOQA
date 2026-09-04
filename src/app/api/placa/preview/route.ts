import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { normalizeLayout, renderPlacas } from "@/lib/placa";
import { FALLBACK_DESIGN, loadDesign } from "@/lib/placa-designs";
import { parseQrId, siteUrl } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Previsualiza UNA placa de un diseño con la posición que venga por
 * querystring, sin guardar nada. Es el PDF real que sale a imprenta.
 */
export async function GET(request: NextRequest) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const url = new URL(request.url);
  const designId = Number(url.searchParams.get("design"));

  const design = Number.isInteger(designId) ? await loadDesign(supabase, designId) : null;
  const base = design ?? FALLBACK_DESIGN;

  const layout = normalizeLayout({
    ...base.layout,
    ...numeric(url, [
      "qrPage",
      "xMm",
      "yMm",
      "sizeMm",
      "quietModules",
      "numberSizeMm",
      "numberXMm",
      "numberYMm",
    ]),
    ...booleans(url, ["whiteBackdrop", "showNumber", "numberBackdrop"]),
  });

  const qrId = parseQrId(url.searchParams.get("id") ?? "1") ?? 1;

  const pdf = await renderPlacas({
    items: [{ qrId, design: { ...base, layout } }],
    baseUrl: siteUrl(),
  });

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="preview.pdf"',
      "Cache-Control": "no-store",
    },
  });
}

function booleans(url: URL, keys: string[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of keys) {
    if (url.searchParams.has(key)) out[key] = url.searchParams.get(key) === "true";
  }
  return out;
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
