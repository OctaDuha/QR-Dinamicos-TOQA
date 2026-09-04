import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { loadPlacaSettings } from "@/lib/placa-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const settings = await loadPlacaSettings(supabase, false);

  return NextResponse.json({
    layout: settings.layout,
    backgroundName: settings.backgroundName,
    hasBackground: settings.backgroundName !== null,
  });
}
