import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { fechaArgentina, fechaCorta, leerRango, type Rango } from "./estadisticas";
import { dibujarReporte, sumarSeries, type TotalPlaca } from "./reporte-imagen";
import { slug } from "./estadisticas-pedido";
import { configWhatsapp, enviarImagen, enviarLista, enviarTexto, type Opcion } from "./whatsapp";

/**
 * El bot de estadísticas. Comparte el número con la persona que atiende el
 * WhatsApp del negocio, así que es callado a propósito: solo contesta
 *   - la palabra "Estadísticas" (es lo que trae escrito el link del cliente),
 *   - las opciones de su propia lista, y
 *   - las fechas, solo si se las acaba de pedir a ese mismo teléfono.
 * Cualquier otro mensaje lo deja pasar sin responder: lo contesta una persona.
 */

export type MensajeEntrante = {
  id: string;
  de: string;
  /** El texto escrito, o el id de la opción elegida de una lista. */
  texto: string | null;
  opcion: string | null;
};

/** Saca de un aviso de Meta los mensajes de clientes (ni estados ni ecos). */
export function leerMensajes(aviso: unknown): MensajeEntrante[] {
  const mensajes: MensajeEntrante[] = [];
  const entradas = (aviso as { entry?: unknown[] })?.entry ?? [];
  for (const entrada of entradas as { changes?: { field?: string; value?: { messages?: unknown[] } }[] }[]) {
    for (const cambio of entrada.changes ?? []) {
      if (cambio.field !== "messages") continue;
      for (const m of (cambio.value?.messages ?? []) as {
        id?: string;
        from?: string;
        type?: string;
        text?: { body?: string };
        interactive?: { list_reply?: { id?: string }; button_reply?: { id?: string } };
      }[]) {
        if (!m.id || !m.from) continue;
        const opcion = m.interactive?.list_reply?.id ?? m.interactive?.button_reply?.id ?? null;
        mensajes.push({
          id: m.id,
          de: m.from.replace(/\D/g, ""),
          texto: m.type === "text" ? (m.text?.body ?? null) : null,
          opcion,
        });
      }
    }
  }
  return mensajes;
}

const DISPARADORES = new Set([
  "estadisticas",
  "estadistica",
  "mis estadisticas",
  "ver estadisticas",
  "ver mis estadisticas",
  "reporte",
  "mi reporte",
]);

/** "📊 Ver Estadísticas!" -> "ver estadisticas" */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function esDisparador(texto: string | null): boolean {
  return texto !== null && DISPARADORES.has(normalizar(texto));
}

const OPCIONES: Opcion[] = [
  { id: "toqa:7d", titulo: "Últimos 7 días" },
  { id: "toqa:30d", titulo: "Últimos 30 días" },
  { id: "toqa:mes", titulo: "Este mes" },
  { id: "toqa:mespasado", titulo: "Mes pasado" },
  { id: "toqa:fechas", titulo: "Otras fechas", descripcion: "Me escribís desde qué día hasta qué día" },
];

const DIA = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** El rango de cada opción, en días de Argentina. */
export function rangoDeOpcion(opcion: string, hoy: string): Rango | null {
  const t = Date.parse(`${hoy}T00:00:00Z`);
  const [anio, mes] = hoy.split("-").map(Number);
  const primero = (a: number, m: number) => `${a}-${String(m).padStart(2, "0")}-01`;
  switch (opcion) {
    case "toqa:7d":
      return leerRango(iso(t - 6 * DIA), hoy, hoy);
    case "toqa:30d":
      return leerRango(iso(t - 29 * DIA), hoy, hoy);
    case "toqa:mes":
      return leerRango(primero(anio, mes), hoy, hoy);
    case "toqa:mespasado": {
      const desde = mes === 1 ? primero(anio - 1, 12) : primero(anio, mes - 1);
      return leerRango(desde, iso(Date.parse(`${primero(anio, mes)}T00:00:00Z`) - DIA), hoy);
    }
    default:
      return null;
  }
}

/**
 * Las fechas como las escribe la gente: "1/9 al 30/9", "01/09/2026 al
 * 30/09/2026", "del 1-9 a 15-9". Sin año, el de hoy (o el anterior, si
 * no la fecha quedaría en el futuro).
 */
export function leerFechas(texto: string, hoy: string): Rango | null {
  const m = texto.match(
    /(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\s*(?:al|a|hasta|-|–|y)\s*(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/i,
  );
  if (!m) return null;
  const anioHoy = Number(hoy.slice(0, 4));
  const fecha = (d: string, mes: string, a: string | undefined) => {
    let anio = a ? Number(a.length === 2 ? `20${a}` : a) : anioHoy;
    const armada = () => `${anio}-${mes.padStart(2, "0")}-${d.padStart(2, "0")}`;
    if (!a && armada() > hoy) anio -= 1;
    return armada();
  };
  const desde = fecha(m[1], m[2], m[3]);
  const hasta = fecha(m[4], m[5], m[6] ?? m[3]);
  return leerRango(desde, hasta, hoy);
}

function clienteBase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Atiende un mensaje. Nunca lanza: lo que falla queda en el registro. */
export async function atender(mensaje: MensajeEntrante): Promise<void> {
  const { llave } = configWhatsapp();
  const supabase = clienteBase();
  if (!llave || !supabase) return;

  const opcionNuestra = mensaje.opcion?.startsWith("toqa:") ? mensaje.opcion : null;
  const disparador = esDisparador(mensaje.texto);

  const { data, error } = await supabase.rpc("bot_recibir", {
    p_llave: llave,
    p_wamid: mensaje.id,
    p_telefono: mensaje.de,
  });
  if (error) {
    console.error("[bot] no pude anotar el mensaje:", error.message);
    return;
  }
  const recibido = data as { nuevo: boolean; espera: string | null; clientes: string[] };
  if (!recibido.nuevo) return; // Meta lo mandó de nuevo: ya se atendió.

  const esperaFechas = recibido.espera === "fechas" && mensaje.texto !== null && !disparador;
  if (!opcionNuestra && !disparador && !esperaFechas) return; // No es para el bot.

  const anotar = (desde: string | null, hasta: string | null, resultado: string) =>
    supabase.rpc("bot_anotar", {
      p_llave: llave,
      p_telefono: mensaje.de,
      p_clientes: recibido.clientes.join(", ") || null,
      p_desde: desde,
      p_hasta: hasta,
      p_resultado: resultado,
    });

  if (recibido.clientes.length === 0) {
    await enviarTexto(
      mensaje.de,
      "Hola 👋 No encontré este número entre nuestros clientes, así que no puedo mostrarte estadísticas. " +
        "Ya quedó anotado: en breve te escribimos para revisarlo.",
    );
    await anotar(null, null, "no-registrado");
    return;
  }

  const hoy = fechaArgentina(new Date());

  if (disparador) {
    await supabase.rpc("bot_esperar", { p_llave: llave, p_telefono: mensaje.de, p_espera: "" });
    const enviado = await enviarLista(
      mensaje.de,
      `Hola 👋 Te muestro los escaneos de ${recibido.clientes.join(" y ")}. ¿De qué período?`,
      "Elegir período",
      OPCIONES,
    );
    if (!enviado.ok) console.error("[bot] no pude mandar la lista:", enviado.error);
    return;
  }

  if (opcionNuestra === "toqa:fechas") {
    await supabase.rpc("bot_esperar", { p_llave: llave, p_telefono: mensaje.de, p_espera: "fechas" });
    await enviarTexto(mensaje.de, "Dale. Escribime las fechas así: 1/9 al 30/9 (o con año: 01/09/2026 al 30/09/2026).");
    return;
  }

  let rango: Rango | null = null;
  if (opcionNuestra) {
    rango = rangoDeOpcion(opcionNuestra, hoy);
  } else if (esperaFechas) {
    rango = leerFechas(mensaje.texto ?? "", hoy);
    if (!rango) {
      // Si parece un intento de fechas, se ayuda; si no, era para una
      // persona y el bot se corre.
      if (/\d/.test(mensaje.texto ?? "")) {
        await enviarTexto(mensaje.de, "No entendí esas fechas 🙈 Probá así: 1/9 al 30/9");
      } else {
        await supabase.rpc("bot_esperar", { p_llave: llave, p_telefono: mensaje.de, p_espera: "" });
      }
      return;
    }
    await supabase.rpc("bot_esperar", { p_llave: llave, p_telefono: mensaje.de, p_espera: "" });
  }
  if (!rango) return;

  const resultado = await mandarReporte(supabase, llave, mensaje.de, rango, recibido.clientes);
  await anotar(rango.desde, rango.hasta, resultado);
}

async function mandarReporte(
  supabase: SupabaseClient,
  llave: string,
  telefono: string,
  rango: Rango,
  clientes: string[],
): Promise<string> {
  const { data, error } = await supabase.rpc("bot_estadisticas", {
    p_llave: llave,
    p_telefono: telefono,
    p_desde: rango.desde,
    p_hasta: rango.hasta,
    p_bucket: rango.bucket,
  });
  if (error) {
    console.error("[bot] no pude leer las estadísticas:", error.message);
    await enviarTexto(telefono, "Uy, no pude armar el reporte ahora. Probá de nuevo en un rato 🙏");
    return "error";
  }

  const filas = (data ?? []) as {
    qr_id: number;
    label: string | null;
    bucket_start: string;
    qr: number;
    nfc: number;
  }[];
  if (filas.length === 0) {
    await enviarTexto(telefono, "Todavía no tenés placas cargadas a tu nombre. En breve lo revisamos 🙌");
    return "sin-placas";
  }

  const porId = new Map<number, { placa: TotalPlaca; serie: { bucket_start: string; qr: number; nfc: number }[] }>();
  for (const fila of filas) {
    const qr = Number(fila.qr);
    const nfc = Number(fila.nfc);
    const actual = porId.get(fila.qr_id) ?? {
      placa: { id: fila.qr_id, label: fila.label, qr: 0, nfc: 0 },
      serie: [],
    };
    actual.placa.qr += qr;
    actual.placa.nfc += nfc;
    actual.serie.push({ bucket_start: fila.bucket_start, qr, nfc });
    porId.set(fila.qr_id, actual);
  }
  const placas = [...porId.values()];
  const qr = placas.reduce((t, p) => t + p.placa.qr, 0);
  const nfc = placas.reduce((t, p) => t + p.placa.nfc, 0);
  const nombre = clientes.join(" y ");

  const imagen = await dibujarReporte({
    titulo: nombre,
    subtitulo: placas.length === 1 ? "1 placa" : `${placas.length} placas`,
    esCliente: true,
    rango,
    puntos: sumarSeries(placas.map((p) => p.serie)),
    porPlaca: placas.map((p) => p.placa),
  });
  const png = await imagen.arrayBuffer();
  const numero = (n: number) => new Intl.NumberFormat("es-AR").format(n);
  const pie =
    `📊 Del ${fechaCorta(rango.desde)} al ${fechaCorta(rango.hasta)}: ${numero(qr + nfc)} escaneos ` +
    `(${numero(qr)} por QR y ${numero(nfc)} por NFC).\n\nPara ver otro período, escribí *Estadísticas*.`;

  const enviado = await enviarImagen(telefono, png, `reporte-${slug(nombre)}-${rango.desde}-al-${rango.hasta}.png`, pie);
  if (!enviado.ok) {
    console.error("[bot] no pude mandar la imagen:", enviado.error);
    return "error";
  }
  return "enviado";
}
