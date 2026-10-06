import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { textosDelBot, type ClaveTexto } from "./bot-textos";
import { fechaArgentina, fechaCorta, leerRango, type Rango } from "./estadisticas";
import { slug } from "./estadisticas-pedido";
import { dibujarReporte, sumarSeries, type TotalPlaca } from "./reporte-imagen";
import { configWhatsapp, enviarImagen, enviarLista, enviarTexto, type Opcion } from "./whatsapp";

/**
 * El bot de TOQA. Comparte el número con la persona que atiende el WhatsApp
 * del negocio, así que habla poco:
 *   - Al empezar una conversación (esa persona no escribía hace 12 horas),
 *     sea lo que sea que escriba, le muestra el menú. A un cliente le
 *     muestra todas las opciones; a quien todavía no es cliente, solo las
 *     que le sirven.
 *   - Contesta siempre lo que se le pide explícito: una opción de sus
 *     menús, "menú" o "estadísticas", y las fechas si se las acaba de pedir.
 *   - Fuera de eso no contesta nada. Y después de "Quiero un producto",
 *     "Problema con mi producto" o "Hablar con una persona" se calla con ese
 *     número por 12 horas: sigue una persona. Si la persona responde desde
 *     la app (con el número conectado en coexistencia), también se calla.
 */

const HORAS_SILENCIO = 12;

export type MensajeEntrante = {
  id: string;
  de: string;
  /** El texto escrito (null si es audio, foto, etc.). */
  texto: string | null;
  /** El id de la opción elegida de una lista. */
  opcion: string | null;
};

/**
 * Saca de un aviso de Meta los mensajes de los clientes, y los números a los
 * que la persona del negocio les escribió desde la app (los "ecos", que
 * llegan con el número en coexistencia). Los estados de entrega se ignoran.
 */
export function leerAviso(aviso: unknown): { mensajes: MensajeEntrante[]; respondidos: string[] } {
  const mensajes: MensajeEntrante[] = [];
  const respondidos: string[] = [];
  const entradas = (aviso as { entry?: unknown[] })?.entry ?? [];
  for (const entrada of entradas as { changes?: { field?: string; value?: Record<string, unknown> }[] }[]) {
    for (const cambio of entrada.changes ?? []) {
      if (cambio.field === "smb_message_echoes") {
        for (const eco of (cambio.value?.message_echoes ?? []) as { to?: string }[]) {
          if (eco.to) respondidos.push(eco.to.replace(/\D/g, ""));
        }
        continue;
      }
      if (cambio.field !== "messages") continue;
      for (const m of (cambio.value?.messages ?? []) as {
        id?: string;
        from?: string;
        type?: string;
        text?: { body?: string };
        interactive?: { list_reply?: { id?: string }; button_reply?: { id?: string } };
      }[]) {
        if (!m.id || !m.from) continue;
        mensajes.push({
          id: m.id,
          de: m.from.replace(/\D/g, ""),
          texto: m.type === "text" ? (m.text?.body ?? null) : null,
          opcion: m.interactive?.list_reply?.id ?? m.interactive?.button_reply?.id ?? null,
        });
      }
    }
  }
  return { mensajes, respondidos };
}

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

const PIDE_ESTADISTICAS = new Set([
  "estadisticas",
  "estadistica",
  "mis estadisticas",
  "ver estadisticas",
  "ver mis estadisticas",
  "reporte",
  "mi reporte",
]);
const PIDE_MENU = new Set(["menu", "el menu", "ver menu", "opciones", "inicio", "volver"]);

export const esPedidoDeEstadisticas = (texto: string | null) => texto !== null && PIDE_ESTADISTICAS.has(normalizar(texto));
export const esPedidoDeMenu = (texto: string | null) => texto !== null && PIDE_MENU.has(normalizar(texto));

/**
 * El menú, en el orden que eligió el dueño. Los de cliente no los ve quien
 * no lo es. WhatsApp rechaza títulos de más de 24 caracteres (el emoji
 * cuenta): lo largo va en la descripción.
 */
const MENU: (Opcion & { soloClientes?: boolean })[] = [
  { id: "toqa:producto", titulo: "🛒 Quiero un producto", descripcion: "Placas, vinilos y más de TOQA" },
  { id: "toqa:estadisticas", titulo: "📊 Estadísticas", descripcion: "Los escaneos de tus productos", soloClientes: true },
  { id: "toqa:como", titulo: "❓ ¿Cómo funciona TOQA?", descripcion: "Cómo funcionan los productos TOQA" },
  {
    id: "toqa:problema",
    titulo: "🔧 Tengo un problema",
    descripcion: "Contanos qué pasa y en breve lo solucionaremos",
    soloClientes: true,
  },
  { id: "toqa:persona", titulo: "💬 Hablar con nosotros", descripcion: "Te responde una persona del equipo" },
];

const PERIODOS: Opcion[] = [
  { id: "toqa:7d", titulo: "Últimos 7 días" },
  { id: "toqa:30d", titulo: "Últimos 30 días" },
  { id: "toqa:mes", titulo: "Este mes" },
  { id: "toqa:mespasado", titulo: "Mes pasado" },
  { id: "toqa:fechas", titulo: "Otras fechas", descripcion: "Me escribís desde qué día hasta qué día" },
];

const VOLVER_AL_MENU = "\n\nSi querés volver al menú, escribí *menú*.";

const DIA = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** El rango de cada período, en días de Argentina. */
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
  return leerRango(fecha(m[1], m[2], m[3]), fecha(m[4], m[5], m[6] ?? m[3]), hoy);
}

function clienteBase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type Recibido = {
  nuevo: boolean;
  conversacion_nueva: boolean;
  silencio: boolean;
  espera: string | null;
  clientes: string[];
  textos: Record<string, string>;
};

/** La persona del negocio le escribió a ese número desde la app: el bot se corre. */
export async function respondioUnaPersona(telefono: string): Promise<void> {
  const { llave } = configWhatsapp();
  const supabase = clienteBase();
  if (!llave || !supabase) return;
  await supabase.rpc("bot_silenciar", { p_llave: llave, p_telefono: telefono, p_horas: HORAS_SILENCIO });
}

/** Atiende un mensaje. Nunca lanza: lo que falla queda en el registro. */
export async function atender(mensaje: MensajeEntrante): Promise<void> {
  const { llave } = configWhatsapp();
  const supabase = clienteBase();
  if (!llave || !supabase) return;

  const { data, error } = await supabase.rpc("bot_recibir", {
    p_llave: llave,
    p_wamid: mensaje.id,
    p_telefono: mensaje.de,
  });
  if (error) {
    console.error("[bot] no pude anotar el mensaje:", error.message);
    return;
  }
  const r = data as Recibido;
  if (!r.nuevo) return; // Meta lo mandó de nuevo: ya se atendió.

  const de = mensaje.de;
  const esCliente = r.clientes.length > 0;
  const textos = textosDelBot(r.textos);
  const opcion = mensaje.opcion?.startsWith("toqa:") ? mensaje.opcion : null;
  const rpc = (fn: string, args: Record<string, unknown>) => supabase.rpc(fn, { p_llave: llave, p_telefono: de, ...args });
  const anotar = (resultado: string, rango?: Rango) =>
    rpc("bot_anotar", {
      p_clientes: r.clientes.join(", ") || null,
      p_desde: rango?.desde ?? null,
      p_hasta: rango?.hasta ?? null,
      p_resultado: resultado,
    });
  const callarse = () => rpc("bot_silenciar", { p_horas: HORAS_SILENCIO });
  const decir = async (clave: ClaveTexto, extra = "") => {
    const enviado = await enviarTexto(de, textos[clave] + extra);
    if (!enviado.ok) console.error(`[bot] no pude mandar "${clave}":`, enviado.error);
  };
  const mostrarMenu = async () => {
    const saludo = esCliente ? textos.saludo_cliente.replaceAll("{nombre}", r.clientes.join(" y ")) : textos.saludo;
    const enviado = await enviarLista(
      de,
      saludo,
      "Ver opciones",
      "Opciones",
      MENU.filter((o) => esCliente || !o.soloClientes),
    );
    if (!enviado.ok) console.error("[bot] no pude mandar el menú:", enviado.error);
  };
  const ofrecerPeriodos = async () => {
    if (!esCliente) {
      await decir("no_cliente");
      await anotar("no-registrado");
      return;
    }
    await rpc("bot_esperar", { p_espera: "" });
    const enviado = await enviarLista(de, "¿De qué período querés ver los escaneos?", "Elegir período", "Período", PERIODOS);
    if (!enviado.ok) console.error("[bot] no pude mandar los períodos:", enviado.error);
  };

  // 1. Lo que se pide explícito se contesta siempre, aunque esté callado.
  if (opcion) {
    switch (opcion) {
      case "toqa:producto":
        await decir("producto");
        await callarse();
        await anotar("producto");
        return;
      case "toqa:estadisticas":
        await ofrecerPeriodos();
        return;
      case "toqa:como":
        await decir("como", VOLVER_AL_MENU);
        return;
      case "toqa:problema":
        await decir("problema");
        await callarse();
        await anotar("problema");
        return;
      case "toqa:persona":
        await decir("persona");
        await callarse();
        await anotar("persona");
        return;
      case "toqa:fechas":
        if (!esCliente) return;
        await rpc("bot_esperar", { p_espera: "fechas" });
        await enviarTexto(de, "Dale. Escribime las fechas así: 1/9 al 30/9 (o con año: 01/09/2026 al 30/09/2026).");
        return;
      default: {
        if (!esCliente) return;
        const rango = rangoDeOpcion(opcion, fechaArgentina(new Date()));
        if (rango) await anotar(await mandarReporte(supabase, llave, de, rango, r.clientes), rango);
        return;
      }
    }
  }

  if (esPedidoDeEstadisticas(mensaje.texto)) {
    await rpc("bot_silenciar", { p_horas: 0 });
    await ofrecerPeriodos();
    return;
  }
  if (esPedidoDeMenu(mensaje.texto)) {
    await rpc("bot_silenciar", { p_horas: 0 });
    await mostrarMenu();
    return;
  }

  // 2. Las fechas, si se las acaba de pedir.
  if (r.espera === "fechas" && mensaje.texto !== null && esCliente) {
    const rango = leerFechas(mensaje.texto, fechaArgentina(new Date()));
    if (rango) {
      await rpc("bot_esperar", { p_espera: "" });
      await anotar(await mandarReporte(supabase, llave, de, rango, r.clientes), rango);
    } else if (/\d/.test(mensaje.texto)) {
      await enviarTexto(de, "No entendí esas fechas 🙈 Probá así: 1/9 al 30/9");
    } else {
      // Escribió otra cosa: era para una persona, el bot se corre.
      await rpc("bot_esperar", { p_espera: "" });
    }
    return;
  }

  // 3. Callado, o en medio de una charla: no se mete.
  if (r.silencio || !r.conversacion_nueva) return;

  // 4. Primer mensaje de una conversación nueva, diga lo que diga: el menú.
  await mostrarMenu();
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
    await enviarTexto(telefono, "Todavía no tenés productos cargados a tu nombre. En breve lo revisamos 🙌");
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
    `(${numero(qr)} por QR y ${numero(nfc)} por NFC).\n\n` +
    "Para ver otro período, escribí *Estadísticas*. Para volver al menú, *menú*.";

  const enviado = await enviarImagen(telefono, png, `reporte-${slug(nombre)}-${rango.desde}-al-${rango.hasta}.png`, pie);
  if (!enviado.ok) {
    console.error("[bot] no pude mandar la imagen:", enviado.error);
    return "error";
  }
  return "enviado";
}
