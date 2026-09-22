import { list, put } from "@vercel/blob";

import { leerRespaldo, respaldoConfigurado } from "./respaldo";

/**
 * La copia que sale de Vercel.
 *
 * Todo lo demas (la copia automatica, las fotos por dia) vive adentro de la
 * cuenta de Vercel: cubre perder la base de datos y cubre que alguien entre
 * al panel y cambie los destinos, pero no cubre perder esa cuenta, porque se
 * va con ella. Un mail con el CSV adjunto deja una copia en una cuarta
 * cuenta, independiente de Vercel, de Supabase y de GitHub, sin que haya que
 * acordarse de nada.
 *
 * No manda la base: manda el CSV que el respaldo automatico ya dejo guardado.
 * Asi esto no necesita ninguna llave nueva contra la base de datos.
 *
 * Sin RESEND_API_KEY y RESPALDO_EMAIL queda inerte y no molesta a nadie.
 */

const MARCA_MAIL = "respaldos/ultimo-mail.txt";
const DIAS_ENTRE_MAILS = 28;
const REMITENTE_POR_DEFECTO = "TOQA <onboarding@resend.dev>";

function claveMail(): string | null {
  return process.env.RESEND_API_KEY?.trim() || null;
}

function destinatario(): string | null {
  return process.env.RESPALDO_EMAIL?.trim() || null;
}

export function mailConfigurado(): boolean {
  return Boolean(claveMail() && destinatario());
}

/** Cuando se mando el ultimo mail con la copia, o null si nunca. */
export async function ultimoMail(): Promise<string | null> {
  if (!respaldoConfigurado()) return null;

  try {
    const { blobs } = await list({ prefix: MARCA_MAIL, limit: 1, ...acceso() });
    return blobs[0] ? new Date(blobs[0].uploadedAt).toISOString() : null;
  } catch {
    return null;
  }
}

function acceso(): { token?: string } {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token ? { token } : {};
}

export type ResultadoMail = { ok: boolean; enviado: boolean; error?: string; motivo?: string };

/**
 * Manda la copia por mail. Con `forzar` sale siempre (el boton del panel);
 * sin `forzar` sale solo si pasaron los dias suficientes, que es como lo
 * llama la tarea diaria.
 */
export async function enviarRespaldoPorMail(forzar = false): Promise<ResultadoMail> {
  const clave = claveMail();
  const para = destinatario();

  if (!clave || !para) {
    return { ok: false, enviado: false, error: "sin configurar" };
  }

  if (!forzar) {
    const ultimo = await ultimoMail();
    if (ultimo) {
      const dias = (Date.now() - new Date(ultimo).getTime()) / 86_400_000;
      if (dias < DIAS_ENTRE_MAILS) {
        return { ok: true, enviado: false, motivo: `el ultimo fue hace ${Math.round(dias)} dias` };
      }
    }
  }

  const csv = await leerRespaldo();
  if (!csv) {
    return { ok: true, enviado: false, motivo: "todavia no hay ninguna copia guardada" };
  }

  const fecha = new Date().toISOString().slice(0, 10);
  const filas = Math.max(0, csv.trim().split("\n").length - 1);

  const respuesta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESPALDO_EMAIL_FROM?.trim() || REMITENTE_POR_DEFECTO,
      to: [para],
      subject: `Copia de seguridad TOQA · ${fecha}`,
      text: [
        `Copia de tus ${filas} QR al ${fecha}.`,
        "",
        "Guardá este mail. Si algún día perdieras la cuenta de Vercel o la base",
        "de datos, este CSV es lo que permite reconstruir todo: tiene el número",
        "de cada placa y a dónde redirige.",
        "",
        "Para restaurar: panel → Importar CSV → subís este archivo. Los números",
        "se conservan, así que las placas ya impresas siguen funcionando.",
      ].join("\n"),
      attachments: [
        {
          filename: `respaldo-toqa-${fecha}.csv`,
          content: Buffer.from(csv, "utf-8").toString("base64"),
        },
      ],
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => "");
    return {
      ok: false,
      enviado: false,
      error: `Resend respondió ${respuesta.status}: ${detalle.slice(0, 300)}`,
    };
  }

  // Recien despues de que salio: si se anotara antes, un fallo dejaria la
  // fecha puesta y no se volveria a intentar hasta dentro de un mes.
  try {
    await put(MARCA_MAIL, new Date().toISOString(), {
      access: "private",
      contentType: "text/plain; charset=utf-8",
      addRandomSuffix: false,
      allowOverwrite: true,
      ...acceso(),
    });
  } catch (error) {
    console.error("[respaldo] mail enviado pero no se pudo anotar:", (error as Error).message);
  }

  return { ok: true, enviado: true };
}
