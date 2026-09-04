import { toCsv } from "./csv";
import { formatQrCode, qrTargetUrl } from "./qr";
import type { QrCode } from "./types";

/**
 * Mismo formato de columnas que usaba la Creacion masiva de Canva:
 *   numero        -> 0001
 *   qr_code       -> URL publica del PNG (es el campo imagen de la plantilla)
 *   destino_actual-> a donde redirige hoy
 *   url_qr        -> la URL fija impresa en la placa
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
