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
 * URL que apunta el QR fisico. Nunca cambia una vez impresa.
 *
 * Lleva "/qr/" para que el QR y el chip tengan cada uno su camino y se
 * distingan por la direccion misma, no por un parametro. Cuesta tamaño: con
 * dominio propio la direccion pasa de 26 a 29 caracteres y el QR sube de
 * 25x25 a 29x29 modulos. Fue una decision tomada sabiendolo.
 *
 * Las formas anteriores (/0001 y /r/0001) siguen funcionando para siempre.
 */
export function qrTargetUrl(id: number | string, base = siteUrl()): string {
  return `${base}/qr/${formatQrCode(id)}`;
}

/**
 * La direccion que se graba en el chip NFC. El numero y el destino son los
 * mismos que los del QR de la misma placa: cambiar el destino desde el panel
 * afecta a los dos por igual. Solo cambia el camino, que es lo que permite
 * contar los toques aparte.
 *
 * Va en el camino y no como parametro (?n) porque un parametro lo puede
 * borrar un navegador o una app que limpie las direcciones; el camino no.
 * Los chips grabados con ?n siguen contando como NFC igual.
 */
export function nfcTargetUrl(id: number | string, base = siteUrl()): string {
  return `${base}/nfc/${formatQrCode(id)}`;
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
 * Acepta 0001 o 1 y devuelve el id numerico. null si no es valido.
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
