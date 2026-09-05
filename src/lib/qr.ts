import QRCode from "qrcode";

/** Ancho fijo del numero de QR: el 1 se muestra e imprime como 0001. */
export const QR_CODE_PAD = 4;

export function formatQrCode(id: number | string): string {
  return String(id).padStart(QR_CODE_PAD, "0");
}

/** Base publica del sitio; es la que queda impresa para siempre en las placas. */
export function siteUrl(): string {
  // Una variable creada pero vacia cuenta como no configurada: si no, los QR
  // saldrian sin dominio y las placas impresas no llevarian a ningun lado.
  const configurada = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configurada) return configurada.replace(/\/+$/, "");

  // En Vercel, mientras no haya dominio propio, sirve el del proyecto.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`.replace(/\/+$/, "");

  return "http://localhost:3000";
}

/**
 * URL que apunta el QR fisico. Nunca cambia.
 *
 * Va sin "/r/" a proposito: cada caracter de menos acerca la direccion al
 * escalon de 25x25 modulos en vez de 29x29, y con dominio propio lo cruza.
 * El camino largo /r/0001 sigue funcionando para placas viejas.
 */
export function qrTargetUrl(id: number | string, base = siteUrl()): string {
  return `${base}/${formatQrCode(id)}`;
}

/** PNG del QR listo para Canva/imprenta. */
export function qrPngBuffer(id: number | string, base?: string, width = 1024): Promise<Buffer> {
  return QRCode.toBuffer(qrTargetUrl(id, base), {
    type: "png",
    width,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#000000ff", light: "#ffffffff" },
  });
}

export function qrPngDataUrl(id: number | string, base?: string, width = 512): Promise<string> {
  return QRCode.toDataURL(qrTargetUrl(id, base), {
    width,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

/**
 * Acepta 0001, 1, /r/0001 y devuelve el id numerico. null si no es valido.
 */
export function parseQrId(raw: string): number | null {
  const cleaned = raw.trim();
  if (!/^\d{1,15}$/.test(cleaned)) return null;
  const id = Number(cleaned);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Normaliza lo que escribe el usuario en "destino": agrega https:// si falta. */
export function normalizeDestination(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}
