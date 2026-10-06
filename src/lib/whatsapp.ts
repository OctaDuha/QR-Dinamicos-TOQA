import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Lo mínimo para hablar con WhatsApp (la API oficial de Meta): comprobar
 * que un aviso viene de Meta y mandar texto, una lista de opciones o una
 * imagen.
 *
 * Variables en Vercel:
 *   WHATSAPP_TOKEN       (Secret) el permiso para mandar mensajes
 *   WHATSAPP_APP_SECRET  (Secret) la clave secreta de la app de Meta, para
 *                        comprobar que los avisos vienen de Meta
 *   WHATSAPP_PHONE_ID    el identificador del número que usa el bot
 *   WHATSAPP_NUMERO      ese número, solo dígitos con código de país, para
 *                        armar el link "wa.me" que se le da al cliente
 *   BOT_LLAVE            (Secret) la llave del bot, generada en el panel
 */

const VERSION = process.env.WHATSAPP_API_VERSION?.trim() || "v23.0";
const BASE = (process.env.WHATSAPP_API_BASE?.trim() || "https://graph.facebook.com").replace(/\/+$/, "");

export function configWhatsapp() {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_ID?.trim();
  const numero = process.env.WHATSAPP_NUMERO?.replace(/\D/g, "") || null;
  const llave = process.env.BOT_LLAVE?.trim() || null;
  return {
    token,
    appSecret,
    phoneId,
    numero,
    llave,
    completa: Boolean(token && appSecret && phoneId && llave),
  };
}

/**
 * La palabra que se pega en Meta para que confirme que la dirección del
 * bot es nuestra. Sale de la llave del bot: no hay que inventar ni guardar
 * otra, y si se cambia la llave, cambia también.
 */
export function tokenVerificacion(): string | null {
  const { llave } = configWhatsapp();
  return llave ? createHmac("sha256", llave).update("toqa-whatsapp-webhook").digest("hex").slice(0, 32) : null;
}

/** Meta firma cada aviso con la clave secreta de la app: si no coincide, no es Meta. */
export function firmaValida(cuerpo: string, encabezado: string | null, appSecret: string): boolean {
  if (!encabezado?.startsWith("sha256=")) return false;
  const esperada = createHmac("sha256", appSecret).update(cuerpo, "utf8").digest();
  const recibida = Buffer.from(encabezado.slice(7), "hex");
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
}

/** El link que abre el chat del bot con "Estadísticas" ya escrito. */
export function linkEstadisticas(numero: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent("Estadísticas")}`;
}

type Respuesta = { ok: true; datos: Record<string, unknown> } | { ok: false; error: string };

async function llamar(ruta: string, cuerpo: BodyInit, json: boolean): Promise<Respuesta> {
  const { token, phoneId } = configWhatsapp();
  if (!token || !phoneId) return { ok: false, error: "WhatsApp sin configurar" };
  try {
    const respuesta = await fetch(`${BASE}/${VERSION}/${phoneId}/${ruta}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, ...(json ? { "Content-Type": "application/json" } : {}) },
      body: cuerpo,
      signal: AbortSignal.timeout(15_000),
    });
    const datos = (await respuesta.json().catch(() => ({}))) as Record<string, unknown> & {
      error?: { message?: string; code?: number };
    };
    if (!respuesta.ok) {
      return { ok: false, error: `${respuesta.status} ${datos.error?.code ?? ""} ${datos.error?.message ?? ""}`.trim() };
    }
    return { ok: true, datos };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/**
 * Manda un mensaje. WhatsApp informa los celulares de Argentina con el 9
 * (549…), pero hay casos en que para responder hay que mandarlo sin el 9:
 * si falla con el 9, se reintenta una vez sin él.
 */
async function mandar(para: string, mensaje: Record<string, unknown>): Promise<Respuesta> {
  const enviar = (a: string) =>
    llamar("messages", JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: a, ...mensaje }), true);
  const primero = await enviar(para);
  if (primero.ok || !para.startsWith("549") || !primero.error.startsWith("4")) return primero;
  const segundo = await enviar(`54${para.slice(3)}`);
  return segundo.ok ? segundo : primero;
}

export function enviarTexto(para: string, texto: string) {
  return mandar(para, { type: "text", text: { body: texto, preview_url: false } });
}

export type Opcion = { id: string; titulo: string; descripcion?: string };

/** Una lista de opciones: se abre con un botón y el cliente toca una. */
export function enviarLista(para: string, texto: string, boton: string, opciones: Opcion[]) {
  return mandar(para, {
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: texto },
      action: {
        button: boton.slice(0, 20),
        sections: [
          {
            title: "Período",
            rows: opciones.map((o) => ({
              id: o.id,
              title: o.titulo.slice(0, 24),
              ...(o.descripcion ? { description: o.descripcion.slice(0, 72) } : {}),
            })),
          },
        ],
      },
    },
  });
}

/** Sube la imagen a WhatsApp y la manda con su texto al pie. */
export async function enviarImagen(para: string, png: ArrayBuffer, nombre: string, pie: string): Promise<Respuesta> {
  const formulario = new FormData();
  formulario.append("messaging_product", "whatsapp");
  formulario.append("type", "image/png");
  formulario.append("file", new Blob([png], { type: "image/png" }), nombre);
  const subida = await llamar("media", formulario, false);
  if (!subida.ok) return subida;
  return mandar(para, { type: "image", image: { id: subida.datos.id, caption: pie.slice(0, 1024) } });
}
