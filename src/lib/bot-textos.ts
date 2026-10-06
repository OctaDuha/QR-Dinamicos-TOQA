/**
 * Los textos que manda el bot. El dueño los cambia en el panel (WhatsApp →
 * Textos del bot); los que no cambió usan estos.
 */
export type ClaveTexto = "saludo_cliente" | "saludo" | "producto" | "como" | "problema" | "persona" | "no_cliente";

export const TEXTOS: { clave: ClaveTexto; titulo: string; ayuda: string; porDefecto: string }[] = [
  {
    clave: "saludo_cliente",
    titulo: "Saludo a un cliente",
    ayuda: "Va arriba del menú cuando escribe alguien cargado en Clientes. {nombre} se cambia por el nombre del negocio.",
    porDefecto: "¡Hola, {nombre}! 👋 Soy el asistente de TOQA. ¿En qué te puedo ayudar?",
  },
  {
    clave: "saludo",
    titulo: "Saludo a alguien que todavía no es cliente",
    ayuda: "Va arriba del menú cuando escribe un número que no está en Clientes.",
    porDefecto: "¡Hola! 👋 Soy el asistente de TOQA. ¿En qué te puedo ayudar?",
  },
  {
    clave: "producto",
    titulo: "🛒 Quiero un producto",
    ayuda: "Después de este mensaje el bot se calla con ese número y seguís vos.",
    porDefecto:
      "¡Qué bueno! 🙌 En TOQA hacemos placas y otros productos con código QR y chip NFC: tus clientes " +
      "escanean o apoyan el celular y llegan a tu Instagram, tu menú, tus reseñas o lo que quieras.\n\n" +
      "Contanos para qué negocio es y qué te gustaría, y en breve te pasamos opciones y precios.",
  },
  {
    clave: "como",
    titulo: "❓ ¿Cómo funciona TOQA?",
    ayuda: "Al final el bot agrega cómo volver al menú.",
    porDefecto:
      "Cada producto TOQA tiene un código QR y un chip NFC. Tus clientes lo escanean con la cámara o " +
      "apoyan el celular, y se abre el link que elijas: Instagram, menú, Google Maps, WhatsApp…\n\n" +
      "Lo mejor: ese link se puede cambiar cuando quieras, sin reimprimir nada. Y podés ver cuánta gente lo usa, " +
      "por QR y por NFC.",
  },
  {
    clave: "problema",
    titulo: "🔧 Tengo un problema",
    ayuda: "Solo lo ven los clientes. Después de este mensaje el bot se calla con ese número y seguís vos.",
    porDefecto:
      "Lamentamos el inconveniente 🙏 Contanos qué pasa (por ejemplo: no abre, abre otra cosa o el NFC no " +
      "responde) y, si podés, mandanos una foto del producto. En breve lo revisamos.",
  },
  {
    clave: "persona",
    titulo: "💬 Hablar con nosotros",
    ayuda: "Después de este mensaje el bot se calla con ese número y seguís vos.",
    porDefecto: "¡Listo! En breve te respondemos por acá 🙌",
  },
  {
    clave: "no_cliente",
    titulo: "Pide estadísticas alguien que no es cliente",
    ayuda: "Por ejemplo, un cliente que escribe desde otro número. Te queda anotado en Últimas consultas.",
    porDefecto:
      "No encontré este número entre nuestros clientes, así que no puedo mostrarte estadísticas. Si ya sos " +
      "cliente, escribinos desde el número que nos diste, o contanos acá y lo revisamos.",
  },
];

export const LARGO_MAXIMO = 1000;

/** Los textos de la base encima de los de siempre. */
export function textosDelBot(guardados: Record<string, string> | null | undefined): Record<ClaveTexto, string> {
  return Object.fromEntries(
    TEXTOS.map(({ clave, porDefecto }) => [clave, guardados?.[clave]?.trim() || porDefecto]),
  ) as Record<ClaveTexto, string>;
}
