import { PDFDocument, StandardFonts, rgb, type PDFEmbeddedPage, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";

export { suggestedSizeMm } from "./page-size";

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
  /** Imprimir el numero (0001) para poder identificar la placa fisica. */
  showNumber: boolean;
  /** Altura del numero en mm. */
  numberSizeMm: number;
  /**
   * Posicion propia del numero: centro horizontal y borde superior del texto,
   * en mm desde arriba a la izquierda de la pagina. Tiene coordenadas propias
   * y no cuelga del QR porque "debajo del QR" no siempre esta libre: en varias
   * placas ahi ya hay texto del diseno.
   */
  numberXMm: number;
  numberYMm: number;
  /** Recuadro blanco detras del numero, para que se lea sobre cualquier fondo. */
  numberBackdrop: boolean;
};

export const DEFAULT_LAYOUT: PlacaLayout = {
  qrPage: 1,
  xMm: 30,
  yMm: 120,
  sizeMm: 40,
  quietModules: 2,
  whiteBackdrop: true,
  showNumber: true,
  numberSizeMm: 5,
  numberXMm: 50,
  numberYMm: 165,
  numberBackdrop: true,
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
    showNumber: value.showNumber !== false,
    numberSizeMm: num(value.numberSizeMm, DEFAULT_LAYOUT.numberSizeMm, 1, 50),
    numberXMm: num(value.numberXMm, DEFAULT_LAYOUT.numberXMm, -500, 2000),
    numberYMm: num(value.numberYMm, DEFAULT_LAYOUT.numberYMm, -500, 2000),
    numberBackdrop: value.numberBackdrop !== false,
  };
}

/**
 * Numero por defecto: centrado justo debajo del QR y proporcional a el. Es un
 * punto de partida razonable; si ahi el diseno ya tiene algo, se mueve con el
 * preview a la vista.
 */
export function numberDefaults(
  xMm: number,
  yMm: number,
  sizeMm: number,
  freeBandYMm?: number | null,
  sample?: { xMm: number; yMm: number; sizeMm: number } | null,
) {
  const redondo = (v: number) => Math.round(v * 10) / 10;

  // 1) Si el diseno ya trae un numero de ejemplo, el nuestro va justo ahi:
  //    queda donde el diseno lo previo y lo tapa el recuadro blanco.
  if (sample) {
    return {
      numberSizeMm: redondo(sample.sizeMm),
      numberXMm: redondo(sample.xMm),
      numberYMm: redondo(sample.yMm),
    };
  }

  // 2) Si no, la primera franja blanca debajo del QR.
  // 3) Y si tampoco hay, pegado al QR, para que el usuario lo corra.
  return {
    numberSizeMm: redondo(sizeMm * 0.13),
    numberXMm: redondo(xMm + sizeMm / 2),
    numberYMm:
      freeBandYMm != null ? redondo(freeBandYMm) : redondo(yMm + sizeMm + sizeMm * 0.08),
  };
}

/**
 * Dibuja el QR como rectangulos vectoriales.
 * Une modulos negros contiguos en una sola barra horizontal: un QR de 29x29
 * pasa de ~450 rectangulos a ~120, y eso se multiplica por cada placa del lote.
 */
function drawQr(
  page: PDFPage,
  text: string,
  layout: PlacaLayout,
  pageHeight: number,
  numberLabel: string,
  font: PDFFont,
) {
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

  drawNumber(page, numberLabel, layout, pageHeight, font);

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

/** El numero identificatorio de la placa, en su propia posicion. */
function drawNumber(
  page: PDFPage,
  label: string,
  layout: PlacaLayout,
  pageHeight: number,
  font: PDFFont,
) {
  if (!layout.showNumber) return;

  const size = layout.numberSizeMm * MM;
  const width = font.widthOfTextAtSize(label, size);
  const left = layout.numberXMm * MM - width / 2;
  const top = pageHeight - layout.numberYMm * MM;

  if (layout.numberBackdrop) {
    const pad = size * 0.25;
    page.drawRectangle({
      x: left - pad,
      y: top - size - pad * 0.6,
      width: width + pad * 2,
      height: size + pad * 1.2,
      color: rgb(1, 1, 1),
    });
  }

  page.drawText(label, {
    x: left,
    // drawText toma la linea de base; el alto de una cifra es ~0,72 del cuerpo.
    y: top - size * 0.78,
    size,
    font,
    color: rgb(0, 0, 0),
  });
}

/**
 * Incrusta todas las paginas de un PDF respetando el origen de su MediaBox.
 *
 * Canva a veces exporta con el origen corrido (por ejemplo y = 8,67 pt). Si se
 * incrusta sin decirle a pdf-lib cual es la caja, el contenido queda desplazado
 * esos milimetros respecto del QR y del numero, y las placas salen mal
 * impresas. Pasando el bounding box explicito, el contenido cae donde debe.
 */
async function embedAllPages(output: PDFDocument, source: PDFDocument) {
  const pages = source.getPages();
  const boxes = pages.map((page) => {
    const box = page.getMediaBox();
    return {
      left: box.x,
      bottom: box.y,
      right: box.x + box.width,
      top: box.y + box.height,
    };
  });
  return output.embedPages(pages, boxes);
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

  // Helvetica es una fuente estandar del formato: no se incrusta, no pesa.
  const font = await output.embedFont(StandardFonts.HelveticaBold);

  // Cada fondo se incrusta una sola vez aunque lo usen 100 placas: por eso
  // un lote de 1000 pesa poco mas de un megabyte.
  const embedded = new Map<number, PDFEmbeddedPage[]>();

  for (const { design } of items) {
    if (embedded.has(design.id) || !design.backgroundPdf) continue;
    const source = await PDFDocument.load(design.backgroundPdf, { ignoreEncryption: true });
    embedded.set(design.id, await embedAllPages(output, source));
  }

  for (const { qrId, design } of items) {
    const target = qrTargetUrl(qrId, baseUrl);
    const pages = embedded.get(design.id) ?? [];

    const numberLabel = formatQrCode(qrId);

    if (pages.length === 0) {
      // Sin fondo cargado: hoja A6 en blanco, solo para no fallar en seco.
      const page = output.addPage([105 * MM, 148 * MM]);
      drawQr(page, target, design.layout, 148 * MM, numberLabel, font);
      continue;
    }

    const qrPageIndex = Math.min(design.layout.qrPage, pages.length) - 1;

    pages.forEach((background, index) => {
      const page = output.addPage([background.width, background.height]);
      page.drawPage(background, { x: 0, y: 0, width: background.width, height: background.height });
      if (index === qrPageIndex) {
        drawQr(page, target, design.layout, background.height, numberLabel, font);
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

/**
 * Reescribe el PDF del fondo a un tamano de pagina concreto, en mm.
 *
 * Canva a veces exporta con la pagina definida en pixeles: un diseno de 10 cm
 * pensado a 300 dpi sale como una pagina de 416,7 mm. Impreso tal cual saldria
 * cuatro veces mas grande. Normalizarlo al subirlo evita esa sorpresa, y de
 * paso hace que los milimetros de la pantalla signifiquen lo que dicen.
 */
export async function resizeBackground(
  source: Buffer,
  widthMm: number,
  heightMm: number,
): Promise<Buffer> {
  const input = await PDFDocument.load(source, { ignoreEncryption: true });
  const output = await PDFDocument.create();

  const targetWidth = widthMm * MM;
  const targetHeight = heightMm * MM;
  const embedded = await embedAllPages(output, input);

  for (const original of embedded) {
    const page = output.addPage([targetWidth, targetHeight]);
    // Se escala proporcionalmente y se centra: si las proporciones no coinciden
    // queda un margen, nunca un diseno estirado.
    const scale = Math.min(targetWidth / original.width, targetHeight / original.height);
    const width = original.width * scale;
    const height = original.height * scale;
    page.drawPage(original, {
      x: (targetWidth - width) / 2,
      y: (targetHeight - height) / 2,
      width,
      height,
    });
  }

  return Buffer.from(await output.save());
}

