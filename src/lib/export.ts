import { toCsv } from "./csv";
import { formatQrCode, qrTargetUrl } from "./qr";
import type { QrCode } from "./types";

/**
 * Planilla de inventario de los QR:
 *   numero        -> 0001
 *   qr_code       -> link directo al PNG, para descargarlo
 *   destino_actual-> a donde redirige hoy
 *   url_qr        -> la URL fija impresa en la placa
 *
 * OJO: esta columna NO sirve para poner el QR en un diseno con la Creacion
 * masiva de Canva. Canva ignora las URLs de imagen: las toma como texto y solo
 * acepta imagenes embebidas como valor de celda en un .xlsx. Las placas se
 * generan desde /dashboard/placa.
 */
export const EXPORT_HEADER = ["numero", "qr_code", "destino_actual", "url_qr"];

export function exportRows(codes: QrCode[], base: string): (string | number)[][] {
  return codes.map((code) => [
    formatQrCode(code.id),
    `${base}/api/qr/${code.id}/png`,
    code.destination_url,
    qrTargetUrl(code.id, base),
  ]);
}

export function exportCsv(codes: QrCode[], base: string): string {
  return toCsv([EXPORT_HEADER, ...exportRows(codes, base)]);
}

export function pngFileName(id: number): string {
  return `qr-${formatQrCode(id)}.png`;
}
