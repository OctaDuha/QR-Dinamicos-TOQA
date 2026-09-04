import { PDFDocument, rgb, type PDFEmbeddedPage, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";

import { formatQrCode, qrTargetUrl } from "./qr";

/**
 * Genera las placas listas para imprenta componiendo:
 *   fondo vectorial exportado de Canva  +  QR dibujado como vectores.
 *
 * El QR se dibuja con rectangulos, no como imagen: el PDF queda vectorial y
 * nitido a cualquier tamano de impresion, y pesa poco aun con 1000 paginas.
 */

export const MM = 72 / 25.4; // milimetros -> puntos PDF

export type PlacaLayout = {
  /** Pagina del fondo donde va el QR (1 = primera). */
  qrPage: number;
  /** Posicion del borde del QR, en mm desde el borde superior izquierdo. */
  xMm: number;
  yMm: number;
  /** Lado del QR en mm (incluye el margen blanco). */
  sizeMm: number;
  /** Margen de silencio, en modulos. El estandar recomienda 4; 2 suele alcanzar. */
  quietModules: number;
  /** Recuadro blanco detras del QR, por si el fondo no es liso ahi. */
  whiteBackdrop: boolean;
};

export const DEFAULT_LAYOUT: PlacaLayout = {
  qrPage: 1,
  xMm: 30,
  yMm: 120,
  sizeMm: 40,
  quietModules: 2,
  whiteBackdrop: true,
};

export function normalizeLayout(raw: unknown): PlacaLayout {
  const value = (raw ?? {}) as Partial<PlacaLayout>;
  const num = (input: unknown, fallback: number, min: number, max: number) => {
    const parsed = Number(input);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  };

  return {
    qrPage: Math.round(num(value.qrPage, DEFAULT_LAYOUT.qrPage, 1, 50)),
    xMm: num(value.xMm, DEFAULT_LAYOUT.xMm, -500, 2000),
    yMm: num(value.yMm, DEFAULT_LAYOUT.yMm, -500, 2000),
    sizeMm: num(value.sizeMm, DEFAULT_LAYOUT.sizeMm, 5, 500),
    quietModules: Math.round(num(value.quietModules, DEFAULT_LAYOUT.quietModules, 0, 8)),
    whiteBackdrop: value.whiteBackdrop !== false,
  };
}

/**
 * Dibuja el QR como rectangulos vectoriales.
 * Une modulos negros contiguos en una sola barra horizontal: un QR de 29x29
 * pasa de ~450 rectangulos a ~120, y eso se multiplica por cada placa del lote.
 */
function drawQr(page: PDFPage, text: string, layout: PlacaLayout, pageHeight: number) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const modules = qr.modules.size;
  const data = qr.modules.data;

  const totalModules = modules + layout.quietModules * 2;
  const box = layout.sizeMm * MM;
  const moduleSize = box / totalModules;

  const left = layout.xMm * MM;
  // El usuario piensa desde arriba; el PDF mide desde abajo.
  const top = pageHeight - layout.yMm * MM;

  if (layout.whiteBackdrop) {
    page.drawRectangle({
      x: left,
      y: top - box,
      width: box,
      height: box,
      color: rgb(1, 1, 1),
    });
  }

  const originX = left + layout.quietModules * moduleSize;
  const originY = top - layout.quietModules * moduleSize;

  for (let row = 0; row < modules; row++) {
    let runStart = -1;

    for (let col = 0; col <= modules; col++) {
      const filled = col < modules && data[row * modules + col] === 1;

      if (filled && runStart === -1) {
        runStart = col;
      } else if (!filled && runStart !== -1) {
        page.drawRectangle({
          x: originX + runStart * moduleSize,
          y: originY - (row + 1) * moduleSize,
          width: (col - runStart) * moduleSize,
          height: moduleSize,
          color: rgb(0, 0, 0),
        });
        runStart = -1;
      }
    }
  }
}

export type PlacaJob = {
  ids: number[];
  backgroundPdf: Buffer | null;
  layout: PlacaLayout;
  baseUrl: string;
};

/**
 * Un PDF con todas las placas del lote. Si el fondo tiene varias paginas
 * (frente y dorso), cada placa las emite todas y el QR va en la que diga
 * `qrPage`.
 */
export async function renderPlacas({
  ids,
  backgroundPdf,
  layout,
  baseUrl,
}: PlacaJob): Promise<Uint8Array> {
  const output = await PDFDocument.create();
  output.setTitle("Placas TOQA");
  output.setCreator("Panel de QR dinámicos TOQA");

  let embedded: PDFEmbeddedPage[] = [];
  let pageSize = { width: 105 * MM, height: 148 * MM }; // A6 vertical por defecto

  if (backgroundPdf) {
    const source = await PDFDocument.load(backgroundPdf, { ignoreEncryption: true });
    const indices = source.getPageIndices();
    embedded = await output.embedPdf(source, indices);
    const first = source.getPage(0);
    pageSize = { width: first.getWidth(), height: first.getHeight() };
  }

  const qrPageIndex = Math.min(layout.qrPage, Math.max(1, embedded.length)) - 1;

  for (const id of ids) {
    const target = qrTargetUrl(id, baseUrl);

    if (embedded.length === 0) {
      const page = output.addPage([pageSize.width, pageSize.height]);
      drawQr(page, target, layout, pageSize.height);
      continue;
    }

    embedded.forEach((background, index) => {
      const page = output.addPage([background.width, background.height]);
      page.drawPage(background, { x: 0, y: 0, width: background.width, height: background.height });
      if (index === qrPageIndex) {
        drawQr(page, target, layout, background.height);
      }
    });
  }

  return output.save();
}

export function placaFileName(ids: number[]): string {
  if (ids.length === 1) return `placa-${formatQrCode(ids[0])}.pdf`;
  return `placas-${formatQrCode(ids[0])}-${formatQrCode(ids[ids.length - 1])}.pdf`;
}
