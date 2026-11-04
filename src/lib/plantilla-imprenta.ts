import type { PDFPage } from "pdf-lib";

import type { Imprenta } from "./placa-layout";

/**
 * Reconoce una plantilla armada por la imprenta (Illustrator): la hoja trae
 * sangrado y marcas de corte, y la pieza terminada está marcada en el PDF
 * como caja de corte (TrimBox), bien adentro de la hoja.
 *
 * Un PDF de Canva no la trae (o la trae igual a la hoja), así que sigue el
 * camino de siempre. Sirve tanto en el servidor como en el navegador: solo
 * mira las cajas de la página, no dibuja nada.
 */

const MM = 72 / 25.4;
/** La caja de corte tiene que quedar al menos a 1 mm de cada borde de la hoja. */
const MARGEN_MINIMO = 1 * MM;

export function cajaDeCorte(page: PDFPage): Imprenta | null {
  const hoja = page.getMediaBox();
  const corte = page.getTrimBox();

  const izquierda = corte.x - hoja.x;
  const abajo = corte.y - hoja.y;
  const derecha = hoja.x + hoja.width - (corte.x + corte.width);
  const arriba = hoja.y + hoja.height - (corte.y + corte.height);
  if ([izquierda, abajo, derecha, arriba].some((m) => !(m >= MARGEN_MINIMO))) return null;

  const redondo = (v: number) => Math.round((v / MM) * 100) / 100;
  return {
    xMm: redondo(izquierda),
    // Como todo el panel, medido desde arriba de la hoja.
    yMm: redondo(arriba),
    anchoMm: redondo(corte.width),
    altoMm: redondo(corte.height),
  };
}
