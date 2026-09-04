"use client";

import type { PlacaLayout } from "./placa";

/**
 * Encuentra el QR de ejemplo dentro del PDF del diseno y devuelve donde
 * ponerlo. Corre en el navegador: pdf.js rasteriza la pagina y jsQR
 * localiza el codigo. Como jsQR solo acepta un QR real, no hay ambiguedad
 * con el logo de NFC ni con otras imagenes cuadradas del diseno.
 *
 * pdf.js y jsQR se cargan bajo demanda: no pesan en ninguna otra pantalla.
 */

const MM_PER_PT = 25.4 / 72;
const SCALE = 2.2; // suficiente para leer un QR de ~50 mm sin tardar

export type Detection = {
  page: number;
  xMm: number;
  yMm: number;
  sizeMm: number;
  pageWidthMm: number;
  pageHeightMm: number;
  content: string;
};

export async function detectQrInPdf(data: ArrayBuffer): Promise<Detection | null> {
  const [pdfjs, jsQrModule] = await Promise.all([
    import("pdfjs-dist"),
    import("jsqr"),
  ]);

  const jsQR = (jsQrModule as unknown as { default: typeof import("jsqr").default }).default;
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;

  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: SCALE });

      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return null;

      // Fondo blanco: un PDF sin fondo propio saldria transparente y jsQR
      // no distingue los modulos.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;

      const hit = scan(context, canvas.width, canvas.height, jsQR);
      if (!hit) continue;

      const unscaled = page.getViewport({ scale: 1 });
      const pxToMm = (unscaled.width * MM_PER_PT) / canvas.width;

      // jsQR marca justo el area de modulos, que es exactamente lo que
      // guardamos: no hay que convertir nada.
      const side = Math.hypot(hit.tr.x - hit.tl.x, hit.tr.y - hit.tl.y) * pxToMm;

      return {
        page: pageNumber,
        xMm: round(hit.tl.x * pxToMm),
        yMm: round(hit.tl.y * pxToMm),
        sizeMm: round(side),
        pageWidthMm: round(unscaled.width * MM_PER_PT),
        pageHeightMm: round(unscaled.height * MM_PER_PT),
        content: hit.content,
      };
    }
  } finally {
    await doc.destroy();
  }

  return null;
}

type Hit = {
  tl: { x: number; y: number };
  tr: { x: number; y: number };
  content: string;
};

/**
 * Primero prueba la pagina entera; si no aparece, la divide en regiones.
 * Un QR chico dentro de una hoja grande se lee mejor recortado.
 */
function scan(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  jsQR: typeof import("jsqr").default,
): Hit | null {
  const grids: [number, number][] = [
    [1, 1],
    [2, 2],
    [3, 3],
    [2, 3],
    [4, 4],
  ];

  for (const [cols, rows] of grids) {
    const cellWidth = Math.floor(width / cols);
    const cellHeight = Math.floor(height / rows);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const image = context.getImageData(
          col * cellWidth,
          row * cellHeight,
          cellWidth,
          cellHeight,
        );
        const result = jsQR(image.data, image.width, image.height);
        if (!result) continue;

        return {
          tl: {
            x: result.location.topLeftCorner.x + col * cellWidth,
            y: result.location.topLeftCorner.y + row * cellHeight,
          },
          tr: {
            x: result.location.topRightCorner.x + col * cellWidth,
            y: result.location.topRightCorner.y + row * cellHeight,
          },
          content: result.data,
        };
      }
    }
  }

  return null;
}

const round = (value: number) => Math.round(value * 10) / 10;

export function applyDetection(layout: PlacaLayout, detection: Detection): PlacaLayout {
  return {
    ...layout,
    qrPage: detection.page,
    xMm: detection.xMm,
    yMm: detection.yMm,
    sizeMm: detection.sizeMm,
  };
}
