import type { SupabaseClient } from "@supabase/supabase-js";

import { fechaArgentina, leerRango, rangoPorDefecto, type Rango } from "./estadisticas";
import { formatQrCode, parseQrId } from "./qr";

export type PlacaPedida = { id: number; label: string | null };

export type Pedido = {
  rango: Rango;
  placas: PlacaPedida[];
  /** "Bar Centro", o "0042" si es una placa sola. */
  nombre: string;
  /** Solo si es una placa sola: su etiqueta, para el título. */
  etiqueta: string | null;
  esCliente: boolean;
};

/**
 * Lee de la dirección qué estadísticas se piden: una placa (?qr=44) o todas
 * las de un cliente (?cliente=3), entre ?desde= y ?hasta= (sin fechas, los
 * últimos 30 días). Devuelve el pedido o el error para mostrar.
 */
export async function leerPedido(
  supabase: SupabaseClient,
  params: URLSearchParams,
): Promise<{ pedido: Pedido } | { error: string; status: number }> {
  const hoy = fechaArgentina(new Date());
  const porDefecto = rangoPorDefecto(hoy);
  const rango = leerRango(params.get("desde") || porDefecto.desde, params.get("hasta") || porDefecto.hasta, hoy);
  if (!rango) return { error: "Esas fechas no son válidas.", status: 400 };

  const qrId = parseQrId(params.get("qr") ?? "");
  const clienteId = parseQrId(params.get("cliente") ?? "");

  if (qrId !== null) {
    const { data } = await supabase.from("qr_codes").select("id, label").eq("id", qrId).maybeSingle<PlacaPedida>();
    if (!data) return { error: "Esa placa no existe.", status: 404 };
    return { pedido: { rango, placas: [data], nombre: formatQrCode(qrId), etiqueta: data.label, esCliente: false } };
  }

  if (clienteId !== null) {
    const [{ data: cliente }, { data: suyas, error }] = await Promise.all([
      supabase.from("clientes").select("nombre").eq("id", clienteId).maybeSingle<{ nombre: string }>(),
      supabase.from("qr_codes").select("id, label").eq("cliente_id", clienteId).order("id"),
    ]);
    if (error || !cliente) return { error: "Ese cliente no existe.", status: 404 };
    const placas = (suyas ?? []) as PlacaPedida[];
    if (placas.length === 0) return { error: "Ese cliente todavía no tiene placas.", status: 404 };
    return { pedido: { rango, placas, nombre: cliente.nombre, etiqueta: null, esCliente: true } };
  }

  return { error: "Falta la placa o el cliente.", status: 400 };
}

/** Para el nombre del archivo: "Pizzería Don Luis" -> "pizzeria-don-luis". */
export function slug(texto: string): string {
  return (
    texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "placas"
  );
}

/** Sin la función de rango en la base, el mensaje dice qué falta correr. */
export function mensajeErrorSerie(error: { code?: string; message: string }): { texto: string; status: number } {
  return error.code === "PGRST202"
    ? { texto: "Para ver estadísticas por fechas falta correr en Supabase el archivo 2026-10-rango-fechas.sql.", status: 501 }
    : { texto: `No pude leer las estadísticas: ${error.message}`, status: 500 };
}
