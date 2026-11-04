import { readFile } from "node:fs/promises";
import { join } from "node:path";

import * as fontkitModulo from "@pdf-lib/fontkit";
import type { Font } from "@pdf-lib/fontkit";
import {
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames,
  appendBezierCurve,
  appendQuadraticCurve,
  clip,
  closePath,
  concatTransformationMatrix,
  endPath,
  fill,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  cmyk,
  rectangle,
  setFillingCmykColor,
  setGraphicsState,
  setLineWidth,
  stroke,
  type PDFEmbeddedPage,
  type PDFOperator as Operador,
  type PDFPage,
  type PDFRef,
} from "pdf-lib";
import QRCode from "qrcode";

import { FUENTES_NUMERO, type FuenteNumero } from "./fuentes-numero";
import { DEMASIA_MM, FRANJA_MM, SANGRADO_MM, esCircular, escalaVinilo } from "./page-size";
import type { PlacaLayout } from "./placa-layout";
import { cajaDeCorte } from "./plantilla-imprenta";

export { suggestedSizeMm } from "./page-size";
export { DEFAULT_LAYOUT, normalizeLayout, numberDefaults, type PlacaLayout } from "./placa-layout";

import { formatQrCode, qrTargetUrl } from "./qr";

/**
 * Genera las placas listas para imprenta componiendo:
 *   fondo vectorial (la plantilla de la imprenta, o un PDF de Canva)
 *   +  QR y numero dibujados como vectores, en CMYK.
 *
 * El QR se dibuja con rectangulos, no como imagen: el PDF queda vectorial y
 * nitido a cualquier tamano de impresion, y pesa poco aun con 1000 paginas.
 */

export const MM = 72 / 25.4; // milimetros -> puntos PDF

/**
 * Todo lo que agrega la pagina va en CMYK, nunca en RGB: las maquinas de la
 * imprenta imprimen en CMYK, y un negro RGB lo convierten en negro de cuatro
 * tintas, que sale con borde de colores. El negro es solo K al 100 %.
 */
const NEGRO = cmyk(0, 0, 0, 1);
const BLANCO = cmyk(0, 0, 0, 0);

/**
 * La tipografia del numero (Noto Sans Bold, la misma del reporte, o la de la
 * plantilla de imprenta). No se incrusta como tipografia: se leen las formas
 * de cada cifra y se dibujan como curvas, porque las maquinas de la imprenta
 * no reconocen tipografias.
 */
// El paquete se publica como CommonJS y como módulo con export por defecto:
// según cómo lo empaquete Next llega de una forma o de la otra.
const fontkit =
  (fontkitModulo as unknown as { default?: typeof fontkitModulo }).default ?? fontkitModulo;

const tipografias = new Map<FuenteNumero, Promise<Font>>();
function cargarTipografia(cual: FuenteNumero): Promise<Font> {
  let fuente = tipografias.get(cual);
  if (!fuente) {
    fuente = readFile(join(process.cwd(), "src/assets/fuentes", FUENTES_NUMERO[cual].archivo)).then((datos) =>
      fontkit.create(datos),
    );
    tipografias.set(cual, fuente);
  }
  return fuente;
}

/**
 * Donde cae el fondo en la hoja, en puntos PDF: borde izquierdo y borde
 * superior. Las coordenadas del diseno se miden desde ahi. En las placas es
 * la hoja entera; en los vinilos circulares el fondo queda corrido hacia
 * adentro por el sangrado.
 */
type Marco = { left: number; top: number };

type Caja = { x: number; y: number; width: number; height: number };

/**
 * Dibuja el QR como rectangulos vectoriales.
 * Une modulos negros contiguos en una sola barra horizontal: un QR de 29x29
 * pasa de ~450 rectangulos a ~120, y eso se multiplica por cada placa del lote.
 */
function drawQr(
  page: PDFPage,
  text: string,
  layout: PlacaLayout,
  marco: Marco,
  numberLabel: string,
  font: Font,
) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const modules = qr.modules.size;
  const data = qr.modules.data;

  // El lado guardado es el area de modulos, asi que el modulo sale de ahi
  // directo y el QR ocupa siempre el mismo espacio visible.
  const side = layout.sizeMm * MM;
  const moduleSize = side / modules;
  const margin = layout.quietModules * moduleSize;

  const originX = marco.left + layout.xMm * MM;
  // El usuario piensa desde arriba; el PDF mide desde abajo.
  const originY = marco.top - layout.yMm * MM;

  if (layout.whiteBackdrop) {
    const box = side + margin * 2;
    page.drawRectangle({
      x: originX - margin,
      y: originY - side - margin,
      width: box,
      height: box,
      color: BLANCO,
    });
  }

  // El número va encima del recuadro blanco del QR y debajo de los módulos.
  // Si va antes, el margen blanco del QR le come la parte de arriba cuando
  // el diseño lo pone pegado (pasó con los vinilos de Google). Y los
  // módulos van últimos para que el número nunca tape el QR.
  drawNumber(page, numberLabel, layout, marco, font);

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
          color: NEGRO,
        });
        runStart = -1;
      }
    }
  }
}

/**
 * El numero identificatorio de la placa, en su propia posicion, en curvas.
 *
 * Se ubica por la tinta, no por la caja de la letra: el borde de arriba de
 * las cifras cae en numberYMm y el centro de lo dibujado en numberXMm. Asi,
 * con la misma tipografia y el mismo cuerpo, el numero real queda exactamente
 * encima del numero de ejemplo que traia el diseno.
 */
function drawNumber(
  page: PDFPage,
  label: string,
  layout: PlacaLayout,
  marco: Marco,
  font: Font,
) {
  if (!layout.showNumber) return;

  const size = layout.numberSizeMm * MM;
  const escala = size / font.unitsPerEm;
  const corrida = font.layout(label);
  const tope = FUENTES_NUMERO[layout.numberFont].tope0 * size;
  // El espacio extra entre cifras, en unidades de la tipografia.
  const extra = (layout.numberSpacingMm * MM) / escala;

  // Donde empieza y termina la tinta, desde el origen del primer glifo.
  let avance = 0;
  let tintaIzquierda = Infinity;
  let tintaDerecha = -Infinity;
  corrida.glyphs.forEach((glifo, i) => {
    const caja = glifo.bbox;
    if (Number.isFinite(caja.minX) && caja.maxX > caja.minX) {
      tintaIzquierda = Math.min(tintaIzquierda, avance + caja.minX);
      tintaDerecha = Math.max(tintaDerecha, avance + caja.maxX);
    }
    avance += corrida.positions[i].xAdvance + extra;
  });
  if (!Number.isFinite(tintaIzquierda)) {
    tintaIzquierda = 0;
    tintaDerecha = avance;
  }

  const ancho = (tintaDerecha - tintaIzquierda) * escala;
  const centro = marco.left + layout.numberXMm * MM;
  const top = marco.top - layout.numberYMm * MM;
  const base = top - tope;
  const origen = centro - ancho / 2 - tintaIzquierda * escala;

  if (layout.numberBackdrop) {
    // Justo lo que ocupan las cifras, con un poco de aire: tapa el numero de
    // ejemplo sin comerse el texto que el diseno tenga cerca. En los disenos
    // de Canva el de ejemplo podia ser de otra letra, mas ancha: ahi va mas aire.
    const pad = size * (layout.numberFont === "noto" ? 0.25 : 0.12);
    page.drawRectangle({
      x: centro - ancho / 2 - pad,
      y: base - size * 0.06 - pad,
      width: ancho + pad * 2,
      height: tope + size * 0.06 + pad * 2,
      color: BLANCO,
    });
  }

  // Cada cifra se dibuja con su contorno, en las unidades de la tipografia y
  // llevada a su lugar con una transformacion.
  let x = origen;
  corrida.glyphs.forEach((glifo, i) => {
    const trazos: Operador[] = [];
    (glifo.path.toFunction() as (ctx: unknown) => void)({
      beginPath: () => {},
      moveTo: (a: number, b: number) => trazos.push(moveTo(a, b)),
      lineTo: (a: number, b: number) => trazos.push(lineTo(a, b)),
      quadraticCurveTo: (a: number, b: number, c: number, d: number) => trazos.push(appendQuadraticCurve(a, b, c, d)),
      bezierCurveTo: (a: number, b: number, c: number, d: number, e: number, f: number) =>
        trazos.push(appendBezierCurve(a, b, c, d, e, f)),
      closePath: () => trazos.push(closePath()),
      fill: () => {},
    });
    if (trazos.length > 0) {
      page.pushOperators(
        pushGraphicsState(),
        concatTransformationMatrix(escala, 0, 0, escala, x, base),
        setFillingCmykColor(0, 0, 0, 1),
        ...trazos,
        fill(),
        popGraphicsState(),
      );
    }
    x += corrida.positions[i].xAdvance * escala + layout.numberSpacingMm * MM;
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

  // Cada fondo se incrusta una sola vez aunque lo usen 100 placas: por eso
  // un lote de 1000 pesa poco mas de un megabyte. Junto con cada pagina se
  // guarda su caja de corte si es una plantilla de imprenta.
  const embedded = new Map<
    number,
    { pagina: PDFEmbeddedPage; corte: ReturnType<typeof cajaDeCorte>; sangrado: Caja }[]
  >();
  // El color de la linea de corte, uno solo para todo el archivo.
  let cutContour: PDFRef | undefined;

  for (const { design } of items) {
    if (embedded.has(design.id) || !design.backgroundPdf) continue;
    const source = await PDFDocument.load(design.backgroundPdf, { ignoreEncryption: true });
    const paginas = await embedAllPages(output, source);
    const originales = source.getPages();
    embedded.set(
      design.id,
      paginas.map((pagina, i) => {
        // El sangrado, medido desde la esquina de la hoja como queda en la salida.
        const hoja = originales[i].getMediaBox();
        const caja = originales[i].getBleedBox();
        return {
          pagina,
          corte: cajaDeCorte(originales[i]),
          sangrado: { x: caja.x - hoja.x, y: caja.y - hoja.y, width: caja.width, height: caja.height },
        };
      }),
    );
  }

  for (const { qrId, design } of items) {
    const target = qrTargetUrl(qrId, baseUrl);
    const pages = embedded.get(design.id) ?? [];
    // El numero va en curvas: no se incrusta ninguna tipografia.
    const font = await cargarTipografia(design.layout.numberFont);

    const numberLabel = formatQrCode(qrId);

    if (pages.length === 0) {
      // Sin fondo cargado: hoja A6 en blanco, solo para no fallar en seco.
      const page = output.addPage([105 * MM, 148 * MM]);
      drawQr(page, target, design.layout, { left: 0, top: 148 * MM }, numberLabel, font);
      continue;
    }

    const qrPageIndex = Math.min(design.layout.qrPage, pages.length) - 1;

    pages.forEach(({ pagina: background, corte, sangrado }, index) => {
      if (corte) {
        // Plantilla de la imprenta: sale tal cual la mando, con su sangrado,
        // sus marcas y su linea de corte. Solo se cambian el QR y el numero.
        const page = output.addPage([background.width, background.height]);
        page.drawPage(background, { x: 0, y: 0, width: background.width, height: background.height });
        // La caja de corte viaja con la hoja: el programa de la imprenta la
        // usa para saber cual es la pieza terminada.
        const x = corte.xMm * MM;
        const ancho = corte.anchoMm * MM;
        const alto = corte.altoMm * MM;
        const y = background.height - corte.yMm * MM - alto;
        page.setTrimBox(x, y, ancho, alto);
        page.setArtBox(x, y, ancho, alto);
        page.setBleedBox(sangrado.x, sangrado.y, sangrado.width, sangrado.height);
        if (index === qrPageIndex) {
          drawQr(page, target, design.layout, { left: 0, top: background.height }, numberLabel, font);
        }
        return;
      }

      if (!esCircular(background.width / MM, background.height / MM)) {
        // Placa rectangular: el diseno tal cual, con DEMASIA_MM en blanco
        // alrededor y la linea de corte en su borde.
        const demasia = DEMASIA_MM * MM;
        const page = output.addPage([background.width + 2 * demasia, background.height + 2 * demasia]);
        page.drawPage(background, { x: demasia, y: demasia, width: background.width, height: background.height });
        if (index === qrPageIndex) {
          drawQr(page, target, design.layout, { left: demasia, top: background.height + demasia }, numberLabel, font);
        }
        cutContour ??= espacioCutContour(output);
        lineaDeCorte(output, page, [rectangle(demasia, demasia, background.width, background.height)], cutContour);
        return;
      }

      const { page, layout, corte: diametro } = paginaCircular(output, background, design.layout);
      if (index === qrPageIndex) {
        drawQr(page, target, layout, { left: 0, top: page.getHeight() }, numberLabel, font);
      }
      // La linea de corte va al final, arriba de todo.
      cutContour ??= espacioCutContour(output);
      const centro = page.getWidth() / 2;
      lineaDeCorte(output, page, circulo(centro, centro, diametro / 2), cutContour);
    });
  }

  return output.save();
}

/* ------------------------------------------------------ vinilos circulares */

/** Un circulo como cuatro curvas: asi lo dibujan todos los programas de diseno. */
function circulo(cx: number, cy: number, r: number) {
  const k = 0.5522847498 * r;
  return [
    moveTo(cx + r, cy),
    appendBezierCurve(cx + r, cy + k, cx + k, cy + r, cx, cy + r),
    appendBezierCurve(cx - k, cy + r, cx - r, cy + k, cx - r, cy),
    appendBezierCurve(cx - r, cy - k, cx - k, cy - r, cx, cy - r),
    appendBezierCurve(cx + k, cy - r, cx + r, cy - k, cx + r, cy),
    closePath(),
  ];
}

/**
 * La hoja de un vinilo circular. El corte es siempre el lado del diseno (10 cm
 * en los de 10x10), y adentro va:
 *   - el diseno agrandado o achicado desde el centro para que su circulo de
 *     color termine a FRANJA_MM del corte;
 *   - recortado justo ahi: lo que el diseno tenga por fuera del aro (fondos,
 *     contornos, una franja propia) no se imprime;
 *   - la franja blanca y el margen de la hoja, sin nada impreso.
 * Asi todos salen del mismo tamano y con la misma franja, sin importar como
 * se dibujo cada uno en Canva.
 *
 * Devuelve tambien la posicion del QR y del numero pasada a la hoja: se
 * mueven y escalan junto con el diseno.
 */
function paginaCircular(output: PDFDocument, background: PDFEmbeddedPage, layout: PlacaLayout) {
  const corte = Math.min(background.width, background.height);
  const lado = corte + 2 * SANGRADO_MM * MM;
  const page = output.addPage([lado, lado]);
  const centro = lado / 2;

  const escala = escalaVinilo(corte / MM, layout.circuloMm);
  const width = background.width * escala;
  const height = background.height * escala;
  page.pushOperators(pushGraphicsState(), ...circulo(centro, centro, corte / 2 - FRANJA_MM * MM), clip(), endPath());
  page.drawPage(background, { x: centro - width / 2, y: centro - height / 2, width, height });
  page.pushOperators(popGraphicsState());

  // Del diseno (mm desde su esquina) a la hoja (mm desde la suya).
  const centroMm = centro / MM;
  const x = (v: number) => centroMm + (v - background.width / MM / 2) * escala;
  const y = (v: number) => centroMm + (v - background.height / MM / 2) * escala;
  const enHoja: PlacaLayout = {
    ...layout,
    xMm: x(layout.xMm),
    yMm: y(layout.yMm),
    sizeMm: layout.sizeMm * escala,
    numberXMm: x(layout.numberXMm),
    numberYMm: y(layout.numberYMm),
    numberSizeMm: layout.numberSizeMm * escala,
  };

  return { page, layout: enHoja, corte };
}

/**
 * El color especial "CutContour": el plotter de corte lo reconoce como la
 * linea por donde cortar y no lo imprime. En pantalla se ve magenta.
 */
function espacioCutContour(output: PDFDocument): PDFRef {
  const { context } = output;
  const tinta = context.obj({ FunctionType: 2, Domain: [0, 1], C0: [0, 0, 0, 0], C1: [0, 1, 0, 0], N: 1 });
  return context.register(
    context.obj([PDFName.of("Separation"), PDFName.of("CutContour"), PDFName.of("DeviceCMYK"), tinta]),
  );
}

/**
 * Linea de corte fina, en sobreimpresion para no dejar un hueco en el diseno.
 * `forma` es el contorno: un circulo en los vinilos, un rectangulo en las placas.
 */
function lineaDeCorte(output: PDFDocument, page: PDFPage, forma: Operador[], cutContour: PDFRef) {
  const { Resources } = page.node.normalizedEntries();
  let espacios = Resources.lookupMaybe(PDFName.of("ColorSpace"), PDFDict);
  if (!espacios) {
    espacios = output.context.obj({});
    Resources.set(PDFName.of("ColorSpace"), espacios);
  }
  espacios.set(PDFName.of("CutContour"), cutContour);

  const sobreimpresion = page.node.newExtGState(
    "GS",
    output.context.obj({ Type: "ExtGState", OP: true, op: true, OPM: 1 }),
  );

  page.pushOperators(
    pushGraphicsState(),
    setGraphicsState(sobreimpresion),
    PDFOperator.of(PDFOperatorNames.StrokingColorspace, [PDFName.of("CutContour")]),
    PDFOperator.of(PDFOperatorNames.StrokingColorN, [PDFNumber.of(1)]),
    setLineWidth(0.25),
    ...forma,
    stroke(),
    popGraphicsState(),
  );
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

