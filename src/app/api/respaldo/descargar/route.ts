import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { leerRespaldo } from "@/lib/respaldo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Baja la ultima copia guardada. Pasa por acá y no por un link directo
 * porque el archivo es privado: tiene los nombres de los clientes y a
 * dónde apunta cada placa.
 */
export async function GET() {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const csv = await leerRespaldo();
  if (csv === null) {
    return new NextResponse("Todavía no hay ninguna copia guardada.", { status: 404 });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="respaldo-toqa-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
