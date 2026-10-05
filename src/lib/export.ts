import { toCsv } from "./csv";
import { formatQrCode, nfcTargetUrl, qrTargetUrl } from "./qr";
import type { QrCode } from "./types";

/**
 * Planilla de inventario de los QR:
 *   numero        -> 0001
 *   etiqueta      -> de quien es esa placa
 *   qr_code       -> link directo al PNG, para descargarlo
 *   destino_actual-> a donde redirige hoy
 *   url_qr        -> la URL fija impresa en la placa
 *   url_nfc       -> la que se graba en el chip, igual pero con la marca
 *   diseno        -> con que diseño se imprime
 *   cliente       -> de qué cliente es (por nombre)
 *
 * Sirve tambien de copia de respaldo: este mismo CSV se vuelve a importar
 * desde el panel y reconstruye los numeros, los destinos, las etiquetas y
 * los diseños y los clientes tal cual estaban (los clientes tienen que
 * existir con ese nombre; sus teléfonos no viajan en esta planilla). Es lo unico que hace falta guardar para que
 * una placa impresa no muera si se pierde la base.
 *
 * OJO: esta columna NO sirve para poner el QR en un diseno con la Creacion
 * masiva de Canva. Canva ignora las URLs de imagen: las toma como texto y solo
 * acepta imagenes embebidas como valor de celda en un .xlsx. Las placas se
 * generan desde /dashboard/placa.
 */
export const EXPORT_HEADER = [
  "numero",
  "etiqueta",
  "qr_code",
  "destino_actual",
  "url_qr",
  "url_nfc",
  "diseno",
  "cliente",
];

export function exportRows(
  codes: QrCode[],
  base: string,
  nombresDeDiseno?: Map<number, string>,
  clientes?: Map<number, string>,
): (string | number)[][] {
  return codes.map((code) => [
    formatQrCode(code.id),
    code.label ?? "",
    `${base}/api/qr/${code.id}/png`,
    code.destination_url,
    qrTargetUrl(code.id, base),
    nfcTargetUrl(code.id, base),
    (code.design_id !== null ? nombresDeDiseno?.get(code.design_id) : "") ?? "",
    clientes?.get(code.id) ?? "",
  ]);
}

export function exportCsv(
  codes: QrCode[],
  base: string,
  nombresDeDiseno?: Map<number, string>,
  clientes?: Map<number, string>,
): string {
  return toCsv([EXPORT_HEADER, ...exportRows(codes, base, nombresDeDiseno, clientes)]);
}

export function pngFileName(id: number): string {
  return `qr-${formatQrCode(id)}.png`;
}
