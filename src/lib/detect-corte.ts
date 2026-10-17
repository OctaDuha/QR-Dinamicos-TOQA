"use client";

import { esCircular } from "./page-size";

/**
 * En un diseno cuadrado (vinilo circular) busca hasta donde llega el
 * dibujo del circulo, para que la linea de corte caiga sobre el color y no
 * deje un filo blanco alrededor.
 *
 * Mira las cuatro diagonales desde el borde del circulo hacia el centro: en
 * los aros partidos (como el de Google) las separaciones caen en los ejes,
 * nunca en las diagonales. Lo que haya en las esquinas, fuera del circulo, no
 * cuenta.
 *
 * Devuelve el diametro en mm, o null si la pagina no es cuadrada.
 */

const MM_PER_PT = 25.4 / 72;
const ESCALA = 3; // ~0,12 mm por pixel en un vinilo de 10 cm
/** El corte entra apenas en el color, para que no quede filo aunque el plotter se corra. */
const MARGEN_MM = 0.3;

export async function detectarCorte(data: ArrayBuffer, pagina = 1): Promise<number | null> {
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
    const maximo = Math.min(cx, cy);
    const mmPorPx = anchoMm / canvas.width;

    // Color de verdad: oscuro o bien saturado. El gris clarito del contorno
    // que trae Canva no cuenta como dibujo.
    const tinta = (x: number, y: number) => {
      const i = (Math.round(y) * canvas.width + Math.round(x)) * 4;
      const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
      const luz = 0.299 * r + 0.587 * g + 0.114 * b;
      return luz < 170 || Math.max(r, g, b) - Math.min(r, g, b) > 70;
    };

    let radio = 0;
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      for (let r = maximo - 1; r > maximo * 0.6; r -= 0.5) {
        if (tinta(cx + (dx * r) / Math.SQRT2, cy + (dy * r) / Math.SQRT2)) {
          radio = Math.max(radio, r);
          break;
        }
      }
    }

    // Sin un borde claro (un fondo liso, un diseno sin aro): el circulo que
    // entra justo en la pagina.
    const diametro = radio > 0 ? 2 * (radio * mmPorPx - MARGEN_MM) : anchoMm;
    return Math.floor(Math.min(diametro, anchoMm) * 10) / 10;
  } finally {
    await doc.destroy();
  }
}
