import { NextResponse } from "next/server";

import { exportCsv } from "@/lib/export";
import { fetchQrCodes, readRange } from "@/lib/export-query";
import { siteUrl } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 20000;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const range = readRange(new URL(request.url));

  let codes;
  try {
    codes = await fetchQrCodes(supabase, range, MAX_ROWS);
  } catch (error) {
    return new NextResponse(`Error al leer los QR: ${(error as Error).message}`, { status: 500 });
  }

  const csv = exportCsv(codes, siteUrl());
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="qrs-toqa-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
