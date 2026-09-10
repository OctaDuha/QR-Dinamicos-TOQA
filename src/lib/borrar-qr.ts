export type ResumenBorrado = {
  total: number;
  conEscaneos: number;
  primeros: number[];
  escaneados: number[];
  borrados: number;
  error?: string;
};

/** Cuerpo que entiende /api/qr/delete: una selección o un rango. */
export type QueBorrar = { ids?: number[]; from?: number; to?: number };

async function pedir(que: QueBorrar, soloMirar: boolean): Promise<ResumenBorrado> {
  const response = await fetch("/api/qr/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...que, soloMirar }),
  });
  const payload = (await response.json().catch(() => ({}))) as Partial<ResumenBorrado> & {
    error?: string;
  };
  if (!response.ok) {
    return { total: 0, conEscaneos: 0, primeros: [], escaneados: [], borrados: 0, error: payload.error ?? "No pude borrar." };
  }
  return {
    total: payload.total ?? 0,
    conEscaneos: payload.conEscaneos ?? 0,
    primeros: payload.primeros ?? [],
    escaneados: payload.escaneados ?? [],
    borrados: payload.borrados ?? 0,
  };
}

/**
 * Los dos pasos del borrado: mirar qué hay, avisar, y recién ahí borrar.
 * Devuelve null si la persona canceló.
 */
export async function borrarConAviso(
  que: QueBorrar,
  formatear: (id: number) => string,
): Promise<ResumenBorrado | null> {
  const previo = await pedir(que, true);
  if (previo.error) return previo;
  if (previo.total === 0) {
    return { ...previo, error: "No hay ningún QR con esos números." };
  }

  const lista = previo.primeros.map(formatear).join(", ");
  const y = previo.total > previo.primeros.length ? ` y ${previo.total - previo.primeros.length} más` : "";

  const aviso =
    `Vas a borrar ${previo.total} QR${previo.conEscaneos > 0 ? ", con todos sus escaneos" : ""}.\n\n` +
    `${lista}${y}\n\n` +
    (previo.conEscaneos > 0
      ? `OJO: ${previo.conEscaneos} de estos ya fueron escaneados alguna vez, así que es probable ` +
        `que haya placas impresas dando vueltas. Esas placas van a dejar de funcionar y no se pueden arreglar.\n\n`
      : "Ninguno tiene escaneos, así que parecen QR de prueba.\n\n") +
    "Esto no se puede deshacer. ¿Seguimos?";

  if (!window.confirm(aviso)) return null;

  return pedir(que, false);
}
