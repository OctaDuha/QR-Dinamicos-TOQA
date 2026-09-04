import JSZip from "jszip";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { formatQrCode } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Junta los PDFs ya exportados del lote en un solo ZIP. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const { id } = await context.params;
  const batchId = Number(id);
  if (!Number.isInteger(batchId)) {
    return new NextResponse("Lote inválido", { status: 400 });
  }

  const { data: items } = await supabase
    .from("canva_batch_items")
    .select("qr_id, export_url")
    .eq("batch_id", batchId)
    .eq("status", "done")
    .order("qr_id", { ascending: true });

  const ready = (items ?? []).filter((item) => item.export_url);

  if (ready.length === 0) {
    return new NextResponse("Todavía no hay PDFs listos en este lote.", { status: 404 });
  }

  const zip = new JSZip();
  const failed: string[] = [];

  for (const item of ready) {
    const code = formatQrCode(item.qr_id as number);
    try {
      const response = await fetch(item.export_url as string, { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      zip.file(`placa-${code}.pdf`, await response.arrayBuffer());
    } catch {
      // Los links de export de Canva caducan; se avisa en el ZIP y se sigue.
      failed.push(code);
    }
  }

  if (failed.length > 0) {
    zip.file(
      "PENDIENTES.txt",
      [
        "Estos PDFs no se pudieron descargar (el link de export de Canva ya venció):",
        ...failed.map((code) => `  placa-${code}.pdf`),
        "",
        "Volvé a generar el lote para esos números.",
      ].join("\n"),
    );
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="canva-lote-${batchId}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
