import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { normalizeLayout } from "@/lib/placa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const layout = normalizeLayout(await request.json().catch(() => ({})));

  const { error } = await supabase
    .from("placa_settings")
    .upsert({ id: 1, layout, updated_at: new Date().toISOString() });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, layout });
}
