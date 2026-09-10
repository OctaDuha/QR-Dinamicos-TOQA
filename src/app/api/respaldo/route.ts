import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { estadoRespaldo, respaldar } from "@/lib/respaldo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cuándo fue la última copia. Lo mira el panel para que no falle en silencio. */
export async function GET() {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  return NextResponse.json(await estadoRespaldo(), {
    headers: { "Cache-Control": "no-store" },
  });
}

/** Guardar una copia ahora, a mano. */
export async function POST() {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const resultado = await respaldar(supabase);
  if (!resultado.ok) {
    return NextResponse.json(
      {
        error:
          resultado.error === "sin configurar"
            ? "El respaldo automático no está configurado todavía."
            : resultado.error,
      },
      { status: resultado.error === "sin configurar" ? 400 : 500 },
    );
  }

  return NextResponse.json(await estadoRespaldo());
}
