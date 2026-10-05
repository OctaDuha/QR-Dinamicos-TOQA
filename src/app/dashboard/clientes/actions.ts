"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import {
  AVISO_MIGRACION_CLIENTES,
  faltaMigracionClientes,
  leerNumerosDePlacas,
  leerTelefonos,
} from "@/lib/clientes";
import { formatQrCode, parseQrId } from "@/lib/qr";
import { respaldarDespues } from "@/lib/respaldo-auto";
import { sesionActual } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

type ErrorDb = { code?: string; message: string };

const fallo = (que: string, error: ErrorDb): ActionState => ({
  ok: false,
  message: faltaMigracionClientes(error) ? AVISO_MIGRACION_CLIENTES : `${que}: ${error.message}`,
});

function datos(formData: FormData) {
  const texto = (campo: string) => String(formData.get(campo) ?? "").trim();
  return {
    nombre: texto("nombre"),
    contacto: texto("contacto") || null,
    notas: texto("notas") || null,
    ...leerTelefonos(texto("telefonos")),
  };
}

function escrito(formData: FormData, nombres: string[]): Record<string, string> {
  return Object.fromEntries(nombres.map((n) => [n, String(formData.get(n) ?? "")]));
}

const CAMPOS_CLIENTE = ["nombre", "contacto", "telefonos", "notas"];

function problemaEnDatos({ nombre, malos }: { nombre: string; malos: string[] }): ActionState | null {
  if (!nombre) return { ok: false, message: "Poné el nombre del negocio." };
  if (malos.length > 0) {
    return {
      ok: false,
      message:
        `No entiendo ${malos.length === 1 ? "este teléfono" : "estos teléfonos"}: ${malos.join(", ")}. ` +
        "Escribilo con código de área, por ejemplo 11 1234-5678 o 351 15 612-3456.",
    };
  }
  return null;
}

export async function crearCliente(prev: ActionState, formData: FormData): Promise<ActionState> {
  const resultado = await crear(prev, formData);
  return resultado.ok ? resultado : { ...resultado, campos: escrito(formData, CAMPOS_CLIENTE) };
}

async function crear(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const d = datos(formData);
  const problema = problemaEnDatos(d);
  if (problema) return problema;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .insert({ nombre: d.nombre, contacto: d.contacto, notas: d.notas })
    .select("id")
    .single<{ id: number }>();
  if (error) return fallo("No pude crear el cliente", error);

  if (d.telefonos.length > 0) {
    const { error: errorTel } = await supabase
      .from("cliente_telefonos")
      .insert(d.telefonos.map((telefono) => ({ cliente_id: data.id, telefono })));
    if (errorTel) return fallo("Creé el cliente, pero no pude guardar los teléfonos", errorTel);
  }

  revalidatePath("/dashboard/clientes");
  redirect(`/dashboard/clientes/${data.id}`);
}

export async function editarCliente(prev: ActionState, formData: FormData): Promise<ActionState> {
  const resultado = await editar(prev, formData);
  return resultado.ok ? resultado : { ...resultado, campos: escrito(formData, CAMPOS_CLIENTE) };
}

async function editar(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = parseQrId(String(formData.get("id") ?? ""));
  if (id === null) return { ok: false, message: "Cliente inválido." };
  const d = datos(formData);
  const problema = problemaEnDatos(d);
  if (problema) return problema;

  const supabase = await createClient();
  const { data: editados, error } = await supabase
    .from("clientes")
    .update({ nombre: d.nombre, contacto: d.contacto, notas: d.notas })
    .eq("id", id)
    .select("id");
  if (error) return fallo("No pude guardar", error);
  if ((editados?.length ?? 0) === 0) return { ok: false, message: "Ese cliente ya no existe." };

  // Los teléfonos se reemplazan por los que quedaron en el cuadro.
  const { error: errorBorrar } = await supabase.from("cliente_telefonos").delete().eq("cliente_id", id);
  if (errorBorrar) return fallo("Guardé los datos, pero no pude actualizar los teléfonos", errorBorrar);
  if (d.telefonos.length > 0) {
    const { error: errorTel } = await supabase
      .from("cliente_telefonos")
      .insert(d.telefonos.map((telefono) => ({ cliente_id: id, telefono })));
    if (errorTel) return fallo("Guardé los datos, pero no pude guardar los teléfonos", errorTel);
  }

  respaldarDespues(supabase);
  revalidatePath("/dashboard/clientes");
  revalidatePath(`/dashboard/clientes/${id}`);
  return { ok: true, message: "Cliente guardado." };
}

/** Solo el dueño. Las placas no se tocan: quedan sin cliente. */
export async function borrarCliente(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = parseQrId(String(formData.get("id") ?? ""));
  if (id === null) return { ok: false, message: "Cliente inválido." };

  const sesion = await sesionActual();
  if (!sesion) return { ok: false, message: "Tu sesión se cerró. Volvé a entrar y probá de nuevo." };
  if (sesion.rol !== "dueno") return { ok: false, message: "Solo el dueño puede borrar clientes." };

  // Primero se sueltan las placas, mientras el cliente todavía existe: así
  // el historial de cada una dice de quién dejó de ser.
  const { error: errorSoltar } = await sesion.supabase.from("qr_codes").update({ cliente_id: null }).eq("cliente_id", id);
  if (errorSoltar) return fallo("No pude soltar sus placas", errorSoltar);

  const { data: borrados, error } = await sesion.supabase.from("clientes").delete().eq("id", id).select("id");
  if (error) return fallo("No pude borrar el cliente", error);
  if ((borrados?.length ?? 0) === 0) return { ok: false, message: "No se borró: ese cliente ya no existe." };

  respaldarDespues(sesion.supabase);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/clientes");
  redirect("/dashboard/clientes");
}

export async function agregarPlacas(prev: ActionState, formData: FormData): Promise<ActionState> {
  const resultado = await agregar(prev, formData);
  return resultado.ok ? resultado : { ...resultado, campos: escrito(formData, ["numeros"]) };
}

async function agregar(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const clienteId = parseQrId(String(formData.get("cliente_id") ?? ""));
  if (clienteId === null) return { ok: false, message: "Cliente inválido." };
  const pasar = formData.get("pasar") === "si";
  const { ids, malos } = leerNumerosDePlacas(String(formData.get("numeros") ?? ""));
  if (malos.length > 0) {
    return { ok: false, message: `No entiendo: ${malos.join(", ")}. Escribí números como 41, 43-45.` };
  }
  if (ids.length === 0) return { ok: false, message: "Escribí los números de las placas." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("qr_codes_with_stats")
    .select("id, cliente_id, cliente_nombre")
    .in("id", ids);
  if (error) return fallo("No pude leer las placas", error);

  const filas = (data ?? []) as { id: number; cliente_id: number | null; cliente_nombre: string | null }[];
  const existen = new Set(filas.map((f) => f.id));
  const noExisten = ids.filter((id) => !existen.has(id));
  const deOtro = filas.filter((f) => f.cliente_id !== null && f.cliente_id !== clienteId);
  const yaEran = filas.filter((f) => f.cliente_id === clienteId).length;
  const asignar = filas.filter((f) => f.cliente_id === null || (pasar && f.cliente_id !== clienteId)).map((f) => f.id);

  if (asignar.length > 0) {
    const { error: errorAsignar } = await supabase.from("qr_codes").update({ cliente_id: clienteId }).in("id", asignar);
    if (errorAsignar) return fallo("No pude asignar las placas", errorAsignar);
    respaldarDespues(supabase);
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/clientes/${clienteId}`);
  }

  const partes: string[] = [];
  if (asignar.length > 0) partes.push(`Listo: agregué ${asignar.length === 1 ? "1 placa" : `${asignar.length} placas`}.`);
  if (yaEran > 0) partes.push(`${yaEran === 1 ? "1 ya era" : `${yaEran} ya eran`} de este cliente.`);
  if (!pasar && deOtro.length > 0) {
    partes.push(
      `No toqué ${deOtro.map((f) => `${formatQrCode(f.id)} (de ${f.cliente_nombre ?? "otro cliente"})`).join(", ")}: ` +
        "si querés pasarlas a este cliente, marcá la casilla y volvé a agregarlas.",
    );
  }
  if (noExisten.length > 0) {
    partes.push(`No existen: ${noExisten.slice(0, 10).map(formatQrCode).join(", ")}${noExisten.length > 10 ? "…" : ""}.`);
  }
  return { ok: asignar.length > 0, message: partes.join(" ") };
}

export async function quitarPlaca(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const clienteId = parseQrId(String(formData.get("cliente_id") ?? ""));
  const qrId = parseQrId(String(formData.get("qr_id") ?? ""));
  if (clienteId === null || qrId === null) return { ok: false, message: "Datos inválidos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("qr_codes")
    .update({ cliente_id: null })
    .eq("id", qrId)
    .eq("cliente_id", clienteId);
  if (error) return fallo("No pude quitarla", error);

  respaldarDespues(supabase);
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/clientes/${clienteId}`);
  return { ok: true, message: `Quité la ${formatQrCode(qrId)}.` };
}

/** Desde la pantalla de una placa: elegir su cliente, o ninguno. */
export async function elegirClienteDePlaca(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const qrId = parseQrId(String(formData.get("qr_id") ?? ""));
  if (qrId === null) return { ok: false, message: "QR inválido." };
  const crudo = String(formData.get("cliente_id") ?? "");
  const clienteId = crudo ? parseQrId(crudo) : null;
  if (crudo && clienteId === null) return { ok: false, message: "Cliente inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("qr_codes").update({ cliente_id: clienteId }).eq("id", qrId);
  if (error) return fallo("No pude guardar", error);

  respaldarDespues(supabase);
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/qr/${qrId}`);
  revalidatePath("/dashboard/clientes");
  return { ok: true, message: clienteId ? "Cliente guardado." : "La placa quedó sin cliente." };
}
