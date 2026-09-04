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
  /**
   * Esquina superior izquierda del AREA DE MODULOS (la parte negra visible),
   * en mm desde el borde superior izquierdo de la pagina.
   */
  xMm: number;
  yMm: number;
  /**
   * Lado del area de modulos, en mm. Es lo que se mide con una regla sobre la
   * placa impresa. A proposito NO incluye el margen blanco: asi dos QR de
   * versiones distintas (mas o menos modulos) ocupan el mismo espacio visible.
   */
  sizeMm: number;
  /** Margen de silencio, en modulos, dibujado POR FUERA del area de modulos. */
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

  // El lado guardado es el area de modulos, asi que el modulo sale de ahi
  // directo y el QR ocupa siempre el mismo espacio visible.
  const side = layout.sizeMm * MM;
  const moduleSize = side / modules;
  const margin = layout.quietModules * moduleSize;

  const originX = layout.xMm * MM;
  // El usuario piensa desde arriba; el PDF mide desde abajo.
  const originY = pageHeight - layout.yMm * MM;

  if (layout.whiteBackdrop) {
    const box = side + margin * 2;
    page.drawRectangle({
      x: originX - margin,
      y: originY - side - margin,
      width: box,
      height: box,
      color: rgb(1, 1, 1),
    });
  }

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

export type LoadedDesign = {
  id: number;
  name: string;
  backgroundPdf: Buffer | null;
  layout: PlacaLayout;
};

export type PlacaItem = { qrId: number; design: LoadedDesign };

/**
 * Un PDF con todas las placas del lote. Cada QR se estampa sobre el fondo de
 * SU diseno, en la posicion de ese diseno, asi que un lote puede mezclar
 * Google, Instagram y WhatsApp sin que se corra nada.
 *
 * Si un fondo tiene varias paginas (frente y dorso), cada placa las emite
 * todas y el QR va en la que diga `qrPage`.
 */
export async function renderPlacas({
  items,
  baseUrl,
}: {
  items: PlacaItem[];
  baseUrl: string;
}): Promise<Uint8Array> {
  const output = await PDFDocument.create();
  output.setTitle("Placas TOQA");
  output.setCreator("Panel de QR dinámicos TOQA");

  // Cada fondo se incrusta una sola vez aunque lo usen 100 placas: por eso
  // un lote de 1000 pesa poco mas de un megabyte.
  const embedded = new Map<number, PDFEmbeddedPage[]>();

  for (const { design } of items) {
    if (embedded.has(design.id) || !design.backgroundPdf) continue;
    const source = await PDFDocument.load(design.backgroundPdf, { ignoreEncryption: true });
    embedded.set(design.id, await output.embedPdf(source, source.getPageIndices()));
  }

  for (const { qrId, design } of items) {
    const target = qrTargetUrl(qrId, baseUrl);
    const pages = embedded.get(design.id) ?? [];

    if (pages.length === 0) {
      // Sin fondo cargado: hoja A6 en blanco, solo para no fallar en seco.
      const page = output.addPage([105 * MM, 148 * MM]);
      drawQr(page, target, design.layout, 148 * MM);
      continue;
    }

    const qrPageIndex = Math.min(design.layout.qrPage, pages.length) - 1;

    pages.forEach((background, index) => {
      const page = output.addPage([background.width, background.height]);
      page.drawPage(background, { x: 0, y: 0, width: background.width, height: background.height });
      if (index === qrPageIndex) {
        drawQr(page, target, design.layout, background.height);
      }
    });
  }

  return output.save();
}

export function placaFileName(ids: number[], designName?: string): string {
  const slug = designName
    ? "-" +
      designName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 30)
    : "";
  if (ids.length === 1) return `placa${slug}-${formatQrCode(ids[0])}.pdf`;
  return `placas${slug}-${formatQrCode(ids[0])}-${formatQrCode(ids[ids.length - 1])}.pdf`;
}
