import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Qué números tiene cada diseño, agrupados en tramos seguidos (1–40, 55–60).
 * Lo usa "Reimprimir QR que ya tengo" para que no haya que ir a la pestaña
 * QRs a buscar de qué número a qué número va cada diseño.
 *
 * Trae solo el número y el diseño, de a 1000 (el tope por pedido de
 * PostgREST). Aun con miles de placas son pocos tramos.
 */

export type NumerosDeDiseno = {
  /** null = números que todavía no tienen diseño asignado. */
  designId: number | null;
  rangos: [number, number][];
  total: number;
};

export async function numerosPorDiseno(supabase: SupabaseClient): Promise<NumerosDeDiseno[]> {
  const porDiseno = new Map<number | null, number[]>();
  const pagina = 1000;

  for (let desde = 0; ; desde += pagina) {
    const { data, error } = await supabase
      .from("qr_codes")
      .select("id, design_id")
      .order("id", { ascending: true })
      .range(desde, desde + pagina - 1);
    // Si no se puede leer, la pantalla sigue andando sin la lista.
    if (error) return [];
    for (const fila of (data ?? []) as { id: number; design_id: number | null }[]) {
      const clave = typeof fila.design_id === "number" ? fila.design_id : null;
      const lista = porDiseno.get(clave) ?? [];
      lista.push(fila.id);
      porDiseno.set(clave, lista);
    }
    if (!data || data.length < pagina) break;
  }

  return [...porDiseno.entries()].map(([designId, ids]) => ({
    designId,
    rangos: tramos(ids),
    total: ids.length,
  }));
}

/** [1,2,3,7,8] -> [[1,3],[7,8]]. Los ids ya vienen ordenados. */
function tramos(ids: number[]): [number, number][] {
  const salida: [number, number][] = [];
  for (const id of ids) {
    const ultimo = salida[salida.length - 1];
    if (ultimo && id === ultimo[1] + 1) ultimo[1] = id;
    else salida.push([id, id]);
  }
  return salida;
}
