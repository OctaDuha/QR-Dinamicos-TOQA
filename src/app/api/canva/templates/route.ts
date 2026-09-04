import { NextResponse } from "next/server";

import { getAccessToken, listBrandTemplates } from "@/lib/canva";
import { requireAdmin } from "@/lib/canva-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const token = await getAccessToken(supabase);
  if (!token) return NextResponse.json({ connected: false, items: [] });

  try {
    const items = await listBrandTemplates(token);
    return NextResponse.json({ connected: true, items });
  } catch (error) {
    // 403 tipico de cuentas sin Enterprise: los brand templates no estan disponibles.
    return NextResponse.json(
      { connected: true, items: [], error: (error as Error).message },
      { status: 200 },
    );
  }
}
