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
  /**
   * Primera franja libre debajo del QR, en mm desde arriba. Es donde conviene
   * poner el numero: en varias placas el espacio inmediatamente bajo el QR ya
   * lo ocupa un texto del diseno ("Escaneá"), y el numero quedaria encima.
   * null si no hay ninguna franja lo bastante alta.
   */
  freeBandYMm: number | null;
  /**
   * Numero de ejemplo ya dibujado en el diseno, si lo hay: varias placas
   * traen uno puesto a mano en Canva. Se reemplaza igual que el QR, asi el
   * numero real queda exactamente donde el diseno lo previo.
   */
  sampleNumber: { xMm: number; yMm: number; sizeMm: number } | null;
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

      const qrBottomPx = hit.tl.y + side / pxToMm;
      const qrWidthPx = side / pxToMm;

      const sample = findSampleNumber(
        context,
        canvas.width,
        canvas.height,
        hit.tl.x,
        hit.tr.x,
        qrBottomPx,
        qrWidthPx,
      );

      // Alto que necesita el numero, en pixeles del render.
      const numberHeightPx = (side * 0.13 * 1.6) / pxToMm;
      const freeBandPx = findFreeBandBelow(
        context,
        canvas.width,
        canvas.height,
        hit.tl.x,
        hit.tr.x,
        hit.tl.y + side / pxToMm,
        numberHeightPx,
      );

      return {
        page: pageNumber,
        xMm: round(hit.tl.x * pxToMm),
        yMm: round(hit.tl.y * pxToMm),
        sizeMm: round(side),
        pageWidthMm: round(unscaled.width * MM_PER_PT),
        pageHeightMm: round(unscaled.height * MM_PER_PT),
        content: hit.content,
        freeBandYMm: freeBandPx === null ? null : round(freeBandPx * pxToMm),
        sampleNumber: sample
          ? {
              xMm: round(sample.centerX * pxToMm),
              yMm: round(sample.top * pxToMm),
              // La altura de una cifra es ~0,72 del cuerpo de la fuente.
              sizeMm: round((sample.height * pxToMm) / 0.72),
            }
          : null,
      };
    }
  } finally {
    await doc.destroy();
  }

  return null;
}

/**
 * Busca el numero de ejemplo que el diseno ya trae debajo del QR.
 *
 * Toma la primera mancha de tinta que aparece bajo el QR y la acepta solo si
 * tiene forma de numerito: angosta y baja respecto del QR. Asi no confunde un
 * texto del diseno como "Escaneá", que ocupa casi todo el ancho.
 */
function findSampleNumber(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  qrLeft: number,
  qrRight: number,
  qrBottom: number,
  qrWidth: number,
): { centerX: number; top: number; height: number } | null {
  // Miramos un poco mas ancho que el QR: el numero puede sobresalir.
  const left = Math.max(0, Math.floor(qrLeft - qrWidth * 0.2));
  const right = Math.min(canvasWidth, Math.ceil(qrRight + qrWidth * 0.2));
  const width = right - left;
  const start = Math.min(canvasHeight - 1, Math.ceil(qrBottom) + 2);
  const height = Math.min(canvasHeight - start, Math.ceil(qrWidth * 0.6));
  if (width <= 0 || height <= 4) return null;

  const strip = context.getImageData(left, start, width, height).data;
  const conTinta = (row: number) => {
    for (let col = 0; col < width; col++) {
      const i = (row * width + col) * 4;
      if (strip[i] < 128 && strip[i + 1] < 128 && strip[i + 2] < 128) return true;
    }
    return false;
  };

  let top = -1;
  let bottom = -1;
  for (let row = 0; row < height; row++) {
    if (conTinta(row)) {
      if (top === -1) top = row;
      bottom = row;
    } else if (top !== -1) {
      break; // termino la primera mancha
    }
  }

  if (top === -1) return null;

  const alto = bottom - top + 1;
  if (alto > qrWidth * 0.3) return null; // demasiado alto para ser un numero

  let minX = width;
  let maxX = -1;
  for (let row = top; row <= bottom; row++) {
    for (let col = 0; col < width; col++) {
      const i = (row * width + col) * 4;
      if (strip[i] < 128 && strip[i + 1] < 128 && strip[i + 2] < 128) {
        if (col < minX) minX = col;
        if (col > maxX) maxX = col;
      }
    }
  }

  const ancho = maxX - minX + 1;
  if (ancho <= 0 || ancho > qrWidth * 0.6) return null; // una palabra, no un numero

  return {
    centerX: left + (minX + maxX) / 2,
    top: start + top,
    height: alto,
  };
}

/**
 * Busca hacia abajo la primera franja de filas completamente blancas, en el
 * ancho del QR. Devuelve la fila donde empieza, o null si no hay lugar.
 */
function findFreeBandBelow(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  qrLeft: number,
  qrRight: number,
  qrBottom: number,
  neededHeight: number,
): number | null {
  const left = Math.max(0, Math.floor(qrLeft));
  const right = Math.min(canvasWidth, Math.ceil(qrRight));
  const width = right - left;
  if (width <= 0) return null;

  const start = Math.min(canvasHeight - 1, Math.ceil(qrBottom) + 2);
  const height = canvasHeight - start;
  if (height <= neededHeight) return null;

  const strip = context.getImageData(left, start, width, height).data;
  const needed = Math.ceil(neededHeight) + 4;

  let run = 0;
  for (let row = 0; row < height; row++) {
    let libre = true;
    for (let col = 0; col < width; col++) {
      const i = (row * width + col) * 4;
      // Casi blanco: dejamos pasar el ruido del antialiasing.
      if (strip[i] < 245 || strip[i + 1] < 245 || strip[i + 2] < 245) {
        libre = false;
        break;
      }
    }

    if (!libre) {
      run = 0;
      continue;
    }

    run++;
    if (run >= needed) {
      // Centramos el numero dentro de la franja encontrada.
      const bandStart = start + row - run + 1;
      return bandStart + (run - neededHeight) / 2;
    }
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
