import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { respaldarDespues } from "@/lib/respaldo-auto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX = 2000;

type Cuerpo = {
  ids?: unknown;
  from?: unknown;
  to?: unknown;
  soloMirar?: boolean;
};

/**
 * Borrado en lote, por seleccion o por rango.
 *
 * Borrar un QR es grave: si hay una placa impresa con ese numero, deja de
 * funcionar y no se puede arreglar. Por eso el flujo es en dos pasos: primero
 * `soloMirar` devuelve cuantos son y cuantos tienen escaneos (senal de que
 * ya estan en la calle), y recien despues se borra.
 */
export async function POST(request: NextRequest) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as Cuerpo;

  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort(
        (a, b) => a - b,
      )
    : [];

  const desde = entero(body.from);
  const hasta = entero(body.to);
  const porRango = ids.length === 0 && (desde !== null || hasta !== null);

  if (ids.length === 0 && !porRango) {
    return NextResponse.json(
      { error: "Decime qué borrar: una selección o un rango de números." },
      { status: 400 },
    );
  }
  if (desde !== null && hasta !== null && desde > hasta) {
    return NextResponse.json({ error: "El “desde” es mayor que el “hasta”." }, { status: 400 });
  }

  // Cuantos son y cuales ya fueron escaneados alguna vez.
  let consulta = supabase
    .from("qr_codes_with_stats")
    .select("id, total_scans")
    .order("id", { ascending: true });

  if (ids.length > 0) consulta = consulta.in("id", ids);
  if (desde !== null) consulta = consulta.gte("id", desde);
  if (hasta !== null) consulta = consulta.lte("id", hasta);

  const { data: filas, error: errorLeer } = await consulta;

  if (errorLeer) {
    return NextResponse.json({ error: errorLeer.message }, { status: 500 });
  }

  const encontrados = (filas ?? []) as { id: number; total_scans: number }[];
  const conEscaneos = encontrados.filter((f) => (f.total_scans ?? 0) > 0);

  const resumen = {
    total: encontrados.length,
    conEscaneos: conEscaneos.length,
    primeros: encontrados.slice(0, 8).map((f) => f.id),
    escaneados: conEscaneos.slice(0, 8).map((f) => f.id),
  };

  if (encontrados.length === 0) {
    return NextResponse.json({ ...resumen, borrados: 0, mensaje: "No hay ningún QR con esos números." });
  }
  if (encontrados.length > MAX) {
    return NextResponse.json(
      { error: `Son ${encontrados.length} QR y el máximo por tanda es ${MAX}. Acotá el rango.` },
      { status: 413 },
    );
  }

  if (body.soloMirar) {
    return NextResponse.json({ ...resumen, borrados: 0 });
  }

  const { error: errorBorrar } = await supabase
    .from("qr_codes")
    .delete()
    .in("id", encontrados.map((f) => f.id));

  if (errorBorrar) {
    return NextResponse.json({ error: errorBorrar.message }, { status: 500 });
  }

  respaldarDespues(supabase);

  return NextResponse.json({ ...resumen, borrados: encontrados.length });
}

function entero(valor: unknown): number | null {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}
