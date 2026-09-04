import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { autofillDesign, exportDesignPdf, getAccessToken, uploadQrAsset } from "@/lib/canva";
import { countItems } from "@/lib/canva-batch";
import { requireAdmin } from "@/lib/canva-guard";
import { formatQrCode, qrPngBuffer, siteUrl } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Margen para cerrar la respuesta antes de que el serverless se corte. */
const TIME_BUDGET_MS = 45_000;

/**
 * Procesa los items pendientes de a tandas. El cliente vuelve a llamar hasta
 * que no queden pendientes; asi un lote de 1000 no depende de un solo request.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const { id } = await context.params;
  const batchId = Number(id);
  if (!Number.isInteger(batchId)) {
    return NextResponse.json({ error: "Lote inválido." }, { status: 400 });
  }

  const { data: batch } = await supabase
    .from("canva_batches")
    .select("id, brand_template_id")
    .eq("id", batchId)
    .maybeSingle();

  if (!batch) {
    return NextResponse.json({ error: "El lote no existe." }, { status: 404 });
  }

  const token = await getAccessToken(supabase);
  if (!token) {
    return NextResponse.json({ error: "Canva no está conectado." }, { status: 400 });
  }

  const started = Date.now();
  const base = siteUrl();
  let processed = 0;

  while (Date.now() - started < TIME_BUDGET_MS) {
    const { data: items } = await supabase
      .from("canva_batch_items")
      .select("id, qr_id, asset_id, design_id")
      .eq("batch_id", batchId)
      .in("status", ["pending", "asset", "design"])
      .order("qr_id", { ascending: true })
      .limit(1);

    const item = items?.[0];
    if (!item) break;

    const itemId = item.id as number;
    const qrId = item.qr_id as number;
    const code = formatQrCode(qrId);

    try {
      let assetId = item.asset_id as string | null;
      if (!assetId) {
        assetId = await uploadQrAsset(token, `QR ${code}`, await qrPngBuffer(qrId, base, 1024));
        await update(supabase, itemId, { status: "asset", asset_id: assetId });
      }

      let designId = item.design_id as string | null;
      if (!designId) {
        designId = await autofillDesign(token, batch.brand_template_id as string, assetId, `QR ${code}`);
        await update(supabase, itemId, { status: "design", design_id: designId });
      }

      const exportUrl = await exportDesignPdf(token, designId);
      await update(supabase, itemId, { status: "done", export_url: exportUrl, error: null });
    } catch (error) {
      await update(supabase, itemId, { status: "error", error: (error as Error).message });
    }

    processed++;
  }

  const progress = await countItems(supabase, batchId);
  const finished = progress.done + progress.failed >= progress.total;

  if (finished) {
    await supabase
      .from("canva_batches")
      .update({ status: progress.failed > 0 ? "error" : "done" })
      .eq("id", batchId);
  }

  return NextResponse.json({ ...progress, processed, finished });
}

async function update(
  supabase: SupabaseClient,
  itemId: number,
  patch: Record<string, unknown>,
) {
  await supabase
    .from("canva_batch_items")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", itemId);
}
