"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseCsv } from "@/lib/csv";
import { formatQrCode, normalizeDestination, parseQrId } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { ok: boolean; message: string | null };

export const IDLE: ActionState = { ok: false, message: null };

const MAX_BATCH = 2000;

/** Crea uno o varios QR nuevos con el mismo destino inicial. */
export async function createQrCodes(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const count = Number(formData.get("count") ?? 1);
  const prefix = String(formData.get("label_prefix") ?? "").trim();
  const destination = normalizeDestination(String(formData.get("destination_url") ?? ""));
  const rawDesign = String(formData.get("design_id") ?? "").trim();
  const designId = rawDesign ? Number(rawDesign) : null;

  if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH) {
    return { ok: false, message: `La cantidad tiene que estar entre 1 y ${MAX_BATCH}.` };
  }
  if (!destination) {
    return { ok: false, message: "El destino no es una URL válida." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("qr_codes")
    .insert(
      Array.from({ length: count }, () => ({
        destination_url: destination,
        design_id: Number.isInteger(designId) ? designId : null,
      })),
    )
    .select("id");

  if (error) {
    return { ok: false, message: `No se pudieron crear los QR: ${error.message}` };
  }

  const ids = (data ?? []).map((row) => row.id as number).sort((a, b) => a - b);

  if (prefix && ids.length > 0) {
    const { error: labelError } = await supabase.from("qr_codes").upsert(
      ids.map((id) => ({
        id,
        label: count === 1 ? prefix : `${prefix} ${formatQrCode(id)}`,
        destination_url: destination,
        design_id: Number.isInteger(designId) ? designId : null,
      })),
    );
    if (labelError) {
      return { ok: false, message: `QR creados, pero fallaron las etiquetas: ${labelError.message}` };
    }
  }

  revalidatePath("/dashboard");

  const range =
    ids.length === 1
      ? `#${formatQrCode(ids[0])}`
      : `#${formatQrCode(ids[0])} → #${formatQrCode(ids[ids.length - 1])}`;

  return { ok: true, message: `${ids.length} QR creado${ids.length === 1 ? "" : "s"} (${range}).` };
}

/** Cambia el destino y/o la etiqueta de un QR. El QR impreso no cambia. */
export async function updateQrCode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = parseQrId(String(formData.get("id") ?? ""));
  const label = String(formData.get("label") ?? "").trim();
  const destination = normalizeDestination(String(formData.get("destination_url") ?? ""));

  if (id === null) {
    return { ok: false, message: "QR inválido." };
  }
  if (!destination) {
    return { ok: false, message: "El destino no es una URL válida." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("qr_codes")
    .update({ destination_url: destination, label: label || null })
    .eq("id", id);

  if (error) {
    return { ok: false, message: `No se pudo guardar: ${error.message}` };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/qr/${id}`);
  return { ok: true, message: "Destino actualizado." };
}

/** Borra un QR y sus escaneos. Ojo: la placa impresa queda muerta. */
export async function deleteQrCode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = parseQrId(String(formData.get("id") ?? ""));
  if (id === null) {
    return { ok: false, message: "QR inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("qr_codes").delete().eq("id", id);

  if (error) {
    return { ok: false, message: `No se pudo borrar: ${error.message}` };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/**
 * Migracion desde la herramienta vieja: importa un CSV conservando los IDs.
 * Es lo unico critico de todo esto: las placas ya impresas apuntan a esos numeros.
 * Columnas aceptadas: numero | id | qr_code  +  destino_actual | destino | destination_url
 * (+ label / etiqueta opcional).
 */
export async function importQrCsv(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Elegí un archivo CSV." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, message: "El archivo supera los 5 MB." };
  }

  const rows = parseCsv(await file.text());
  if (rows.length < 2) {
    return { ok: false, message: "El CSV está vacío o no tiene encabezado." };
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idCol = findColumn(header, ["numero", "número", "id", "qr_code", "codigo", "código"]);
  const destCol = findColumn(header, [
    "destino_actual",
    "destino",
    "destination_url",
    "url_destino",
    "destination",
  ]);
  const labelCol = findColumn(header, ["label", "etiqueta", "nombre", "cliente"]);

  if (idCol === -1 || destCol === -1) {
    return {
      ok: false,
      message:
        "Faltan columnas. Necesito una de numero/id/qr_code y una de destino_actual/destino/destination_url.",
    };
  }

  const records: { id: number; destination_url: string; label: string | null }[] = [];
  const problems: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = parseQrId(row[idCol] ?? "");
    const destination = normalizeDestination(row[destCol] ?? "");

    if (id === null) {
      problems.push(`fila ${i + 1}: número inválido ("${(row[idCol] ?? "").slice(0, 30)}")`);
      continue;
    }
    if (!destination) {
      problems.push(`fila ${i + 1}: destino inválido ("${(row[destCol] ?? "").slice(0, 30)}")`);
      continue;
    }

    records.push({
      id,
      destination_url: destination,
      label: labelCol === -1 ? null : (row[labelCol] ?? "").trim() || null,
    });
  }

  if (records.length === 0) {
    return { ok: false, message: `No se importó nada. ${problems.slice(0, 3).join(" · ")}` };
  }

  const supabase = await createClient();

  for (let i = 0; i < records.length; i += 500) {
    const { error } = await supabase
      .from("qr_codes")
      .upsert(records.slice(i, i + 500), { onConflict: "id" });
    if (error) {
      return { ok: false, message: `Falló la importación en la fila ~${i + 2}: ${error.message}` };
    }
  }

  // Sin esto, el proximo QR nuevo intentaria reusar un id ya importado.
  const { error: seqError } = await supabase.rpc("sync_qr_id_sequence");
  if (seqError) {
    return {
      ok: false,
      message: `Se importaron ${records.length} QR, pero falló el ajuste de la secuencia: ${seqError.message}`,
    };
  }

  revalidatePath("/dashboard");

  const skipped = problems.length
    ? ` ${problems.length} fila${problems.length === 1 ? "" : "s"} salteada${problems.length === 1 ? "" : "s"}: ${problems.slice(0, 3).join(" · ")}${problems.length > 3 ? " …" : ""}`
    : "";

  return { ok: true, message: `${records.length} QR importados conservando su número.${skipped}` };
}

function findColumn(header: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const index = header.indexOf(candidate);
    if (index !== -1) return index;
  }
  return -1;
}
