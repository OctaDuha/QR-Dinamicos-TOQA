/**
 * Detecta la pagina exportada en pixeles: Canva la escribe como puntos, asi
 * que un diseno de 10 cm pensado a 300 dpi sale como una pagina de 416,7 mm.
 *
 * El test es deliberadamente estricto —una placa de 100x150 mm o una hoja A4
 * no deben marcarse— y pide las tres cosas a la vez: pagina absurdamente
 * grande para una placa, division que cae casi exacta sobre un entero, y
 * resultado dentro de un tamano de placa razonable.
 *
 * Vive aparte de placa.ts para poder usarse en el navegador sin arrastrar
 * pdf-lib ni qrcode al bundle.
 */
export function suggestedSizeMm(widthMm: number, heightMm: number) {
  if (Math.max(widthMm, heightMm) <= 300) return null;

  for (const [factor, dpi] of [[300 / 72, 300], [150 / 72, 150], [96 / 72, 96]] as const) {
    const width = widthMm / factor;
    const height = heightMm / factor;
    const casiEntero = (v: number) => Math.abs(v - Math.round(v)) < 0.15;
    const razonable = (v: number) => v >= 40 && v <= 250;

    if (casiEntero(width) && casiEntero(height) && razonable(width) && razonable(height)) {
      return { widthMm: Math.round(width), heightMm: Math.round(height), dpi };
    }
  }
  return null;
}

/** Sangrado de los vinilos circulares: el color sigue 2 mm por fuera del corte. */
export const SANGRADO_MM = 2;

/**
 * Los disenos cuadrados (los vinilos de 10x10) se imprimen redondos: van con
 * linea de corte circular y sangrado. Los rectangulares, como las placas de
 * 10x15, quedan como siempre.
 */
export function esCircular(widthMm: number | null | undefined, heightMm: number | null | undefined) {
  return Boolean(widthMm && heightMm && Math.abs(widthMm - heightMm) <= 0.5);
}
