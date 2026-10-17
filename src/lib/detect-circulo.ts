"use client";

import { esCircular } from "./page-size";

/**
 * En un diseno cuadrado (vinilo circular) mide el circulo de color: hasta
 * donde llega el aro, por fuera. Con eso el diseno se lleva al tamano justo
 * para que todos los vinilos salgan iguales.
 *
 * Mira las cuatro diagonales desde el borde hacia el centro: en los aros
 * partidos (como el de Google) las separaciones caen en los ejes, nunca en
 * las diagonales. Lo que haya por fuera del aro no cuenta: un fondo de color
 * en las esquinas o un contorno fino son tramos cortos de color, y el aro es
 * el primer tramo ancho.
 *
 * Devuelve el diametro en mm, o null si la pagina no es cuadrada o no hay un
 * aro claro.
 */

const MM_PER_PT = 25.4 / 72;
const ESCALA = 3; // ~0,12 mm por pixel en un vinilo de 10 cm
/** El aro tiene que tener al menos este ancho; lo mas fino es contorno o fondo. */
const ARO_MINIMO_MM = 2.5;
/** Cortes mas chicos que esto dentro del color (antialias, degradés) no lo interrumpen. */
const HUECO_MM = 0.25;
const BORDE_SUAVE_MM = 0.2;

export async function detectarCirculo(data: ArrayBuffer, pagina = 1): Promise<number | null> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  try {
    const page = await doc.getPage(Math.min(Math.max(1, pagina), doc.numPages));
    const base = page.getViewport({ scale: 1 });
    const anchoMm = base.width * MM_PER_PT;
    if (!esCircular(anchoMm, base.height * MM_PER_PT)) return null;

    const viewport = page.getViewport({ scale: ESCALA });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;

    const { data: px } = context.getImageData(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const maximo = Math.min(cx, cy) - 1;
    const mmPorPx = anchoMm / canvas.width;
    const paso = 0.5;

    // Color de verdad: oscuro o bien saturado. El blanco y el gris clarito no.
    const tinta = (x: number, y: number) => {
      const i = (Math.round(y) * canvas.width + Math.round(x)) * 4;
      const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
      const luz = 0.299 * r + 0.587 * g + 0.114 * b;
      return luz < 170 || Math.max(r, g, b) - Math.min(r, g, b) > 70;
    };

    const radios: number[] = [];
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      let inicio: number | null = null; // donde empezo el tramo de color actual
      let ultimo = 0; // ultimo pixel con color del tramo
      for (let r = maximo; r > maximo * 0.5; r -= paso) {
        if (tinta(cx + (dx * r) / Math.SQRT2, cy + (dy * r) / Math.SQRT2)) {
          if (inicio === null || (ultimo - r) * mmPorPx > HUECO_MM) inicio = r;
          ultimo = r;
          if ((inicio - r) * mmPorPx >= ARO_MINIMO_MM) {
            radios.push(inicio);
            break;
          }
        }
      }
    }

    // Con al menos dos diagonales de acuerdo alcanza; se toma la mas grande
    // para no comerse el aro. El borde suavizado del render suma ~0,2 mm.
    if (radios.length < 2) return null;
    return Math.round((Math.max(...radios) * mmPorPx * 2 - BORDE_SUAVE_MM) * 10) / 10;
  } finally {
    await doc.destroy();
  }
}
