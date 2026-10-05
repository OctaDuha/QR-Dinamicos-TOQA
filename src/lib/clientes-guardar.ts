import type { SupabaseClient } from "@supabase/supabase-js";

import { faltaMigracionClientes, leerTelefonos } from "./clientes";

/**
 * Lo que se escribe en "Editar" de una placa sobre su cliente. Se lee y se
 * valida antes de tocar nada, para no guardar la mitad si un teléfono está mal.
 */
export type ClienteEscrito = { negocio: string; contacto: string | null; telefonos: string[] };

export function leerClienteEscrito(formData: FormData): { cliente: ClienteEscrito } | { error: string } {
  const texto = (campo: string) => String(formData.get(campo) ?? "").trim();
  const { telefonos, malos } = leerTelefonos(texto("cliente_telefonos"));
  if (malos.length > 0) {
    return {
      error:
        `No entiendo ${malos.length === 1 ? "este WhatsApp" : "estos WhatsApp"}: ${malos.join(", ")}. ` +
        "Escribilo con código de área, por ejemplo 11 1234-5678 o 351 15 612-3456.",
    };
  }
  return { cliente: { negocio: texto("cliente_negocio"), contacto: texto("cliente_contacto") || null, telefonos } };
}

/**
 * Deja la placa con ese cliente. Si el negocio ya existe (sin importar
 * mayúsculas) se usa ese y se actualizan sus datos con lo escrito; si no,
 * se crea. Sin negocio, la placa queda sin cliente.
 *
 * Lo que quedó vacío no borra nada: un cliente que ya tenía contacto o
 * WhatsApp los conserva. Para sacarle todos los teléfonos está su ficha.
 */
export async function guardarClienteDePlaca(
  supabase: SupabaseClient,
  qrId: number,
  escrito: ClienteEscrito,
): Promise<{ error?: string; creado?: string }> {
  if (!escrito.negocio) {
    const { error } = await supabase.from("qr_codes").update({ cliente_id: null }).eq("id", qrId);
    return error ? { error: mensaje(error) } : {};
  }

  const { data: clientes, error: errorLeer } = await supabase.from("clientes").select("id, nombre");
  if (errorLeer) return { error: mensaje(errorLeer) };

  const buscado = escrito.negocio.toLowerCase();
  let id = ((clientes ?? []) as { id: number; nombre: string }[]).find(
    (c) => c.nombre.trim().toLowerCase() === buscado,
  )?.id;
  let creado: string | undefined;

  if (id === undefined) {
    const { data, error } = await supabase
      .from("clientes")
      .insert({ nombre: escrito.negocio, contacto: escrito.contacto })
      .select("id")
      .single<{ id: number }>();
    if (error) return { error: mensaje(error) };
    id = data.id;
    creado = escrito.negocio;
  } else if (escrito.contacto) {
    const { error } = await supabase.from("clientes").update({ contacto: escrito.contacto }).eq("id", id);
    if (error) return { error: mensaje(error) };
  }

  if (escrito.telefonos.length > 0) {
    const { error: errorBorrar } = await supabase.from("cliente_telefonos").delete().eq("cliente_id", id);
    if (errorBorrar) return { error: mensaje(errorBorrar) };
    const { error } = await supabase
      .from("cliente_telefonos")
      .insert(escrito.telefonos.map((telefono) => ({ cliente_id: id, telefono })));
    if (error) return { error: mensaje(error) };
  }

  const { error } = await supabase.from("qr_codes").update({ cliente_id: id }).eq("id", qrId);
  return error ? { error: mensaje(error) } : { creado };
}

function mensaje(error: { code?: string; message: string }): string {
  return faltaMigracionClientes(error)
    ? "Para guardar el cliente falta correr en Supabase el archivo 2026-10-clientes.sql."
    : error.message;
}
