import { NextResponse, type NextRequest } from "next/server";

import { countItems } from "@/lib/canva-batch";
import { getAccessToken } from "@/lib/canva";
import { requireAdmin } from "@/lib/canva-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITEMS = 1000;

/** Lote nuevo: una fila por QR, todas pendientes. El trabajo real lo hace /process. */
export async function POST(request: NextRequest) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    brand_template_id?: string;
    from?: number;
    to?: number;
  };

  const brandTemplateId = (body.brand_template_id ?? process.env.CANVA_BRAND_TEMPLATE_ID ?? "").trim();
  if (!brandTemplateId) {
    return NextResponse.json({ error: "Elegí la plantilla de Canva." }, { status: 400 });
  }

  const token = await getAccessToken(supabase);
  if (!token) {
    return NextResponse.json({ error: "Canva no está conectado." }, { status: 400 });
  }

  let query = supabase.from("qr_codes").select("id").order("id", { ascending: true }).limit(MAX_ITEMS + 1);
  if (Number.isInteger(body.from)) query = query.gte("id", body.from!);
  if (Number.isInteger(body.to)) query = query.lte("id", body.to!);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (data ?? []).map((row) => row.id as number);
  if (ids.length === 0) {
    return NextResponse.json({ error: "No hay QR en ese rango." }, { status: 400 });
  }
  if (ids.length > MAX_ITEMS) {
    return NextResponse.json(
      { error: `Son ${ids.length} QR y el máximo por lote es ${MAX_ITEMS}. Acotá el rango.` },
      { status: 400 },
    );
  }

  const { data: batch, error: batchError } = await supabase
    .from("canva_batches")
    .insert({ brand_template_id: brandTemplateId })
    .select("id")
    .single();

  if (batchError || !batch) {
    return NextResponse.json({ error: batchError?.message ?? "No pude crear el lote." }, { status: 500 });
  }

  const batchId = batch.id as number;

  for (let i = 0; i < ids.length; i += 500) {
    const { error: itemsError } = await supabase
      .from("canva_batch_items")
      .insert(ids.slice(i, i + 500).map((qrId) => ({ batch_id: batchId, qr_id: qrId })));
    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: batchId, total: ids.length });
}

/** Ultimos lotes con su progreso, para la pantalla de Canva. */
export async function GET() {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const { data: batches, error } = await supabase
    .from("canva_batches")
    .select("id, brand_template_id, status, error, created_at")
    .order("id", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = await Promise.all(
    (batches ?? []).map(async (batch) => ({
      ...batch,
      ...(await countItems(supabase, batch.id as number)),
    })),
  );

  return NextResponse.json({ batches: results });
}
