import { NextResponse } from "next/server";

import { disconnect } from "@/lib/canva";
import { requireAdmin } from "@/lib/canva-guard";
import { siteUrl } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  await disconnect(supabase);
  return NextResponse.redirect(`${siteUrl()}/dashboard/canva`, { status: 303 });
}
