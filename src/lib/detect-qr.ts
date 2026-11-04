"use client";

import { FUENTES_NUMERO, type FuenteNumero } from "./fuentes-numero";
import type { PlacaLayout } from "./placa-layout";

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
  sampleNumber: { xMm: number; yMm: number; sizeMm: number; spacingMm?: number; font?: FuenteNumero } | null;
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

      const muestra = findSampleNumber(
        context,
        canvas.width,
        canvas.height,
        hit.tl.x,
        hit.tr.x,
        qrBottomPx,
        qrWidthPx,
      );
      // En los vinilos el número mide 1 mm: a la escala de la búsqueda del QR
      // son 6 píxeles. Se vuelve a dibujar esa zona bien grande para medirlo
      // al centésimo y reconocer la tipografía.
      const sample = muestra
        ? await afinarNumero(page, {
            x: muestra.left / SCALE,
            y: muestra.top / SCALE,
            w: (muestra.right - muestra.left) / SCALE,
            h: muestra.height / SCALE,
          }).catch(() => null)
        : null;

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
          ? sample
          : muestra
            ? {
                xMm: round(muestra.centerX * pxToMm),
                yMm: round(muestra.top * pxToMm),
                sizeMm: round((muestra.height * pxToMm) / FUENTES_NUMERO.noto.alto0),
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
): { centerX: number; left: number; right: number; top: number; height: number } | null {
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
    left: left + minX,
    right: left + maxX + 1,
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

type PaginaPdf = Awaited<ReturnType<Awaited<ReturnType<typeof import("pdfjs-dist").getDocument>["promise"]>["getPage"]>>;
type Mapa = boolean[][];

/**
 * Mide el número de ejemplo en serio: dibuja solo esa zona a unos 160 píxeles
 * de alto, toma la tinta y separa la primera cifra, que siempre es un "0"
 * (los números van con ceros adelante). Con ese "0" elige la tipografía y
 * calcula el cuerpo exacto. `caja` viene en puntos desde arriba a la izquierda.
 */
async function afinarNumero(
  page: PaginaPdf,
  caja: { x: number; y: number; w: number; h: number },
): Promise<{ xMm: number; yMm: number; sizeMm: number; spacingMm?: number; font?: FuenteNumero } | null> {
  const margen = caja.h * 0.35;
  const region = { x: caja.x - margen, y: caja.y - margen, w: caja.w + 2 * margen, h: caja.h + 2 * margen };
  const escala = Math.min(80, 160 / caja.h);
  const ancho = Math.ceil(region.w * escala);
  const alto = Math.ceil(region.h * escala);
  if (ancho <= 0 || alto <= 0 || ancho * alto > 16_000_000) return null;

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, ancho, alto);
  await page.render({
    canvasContext: context,
    viewport: page.getViewport({ scale: escala }),
    transform: [1, 0, 0, 1, -region.x * escala, -region.y * escala],
  }).promise;

  const mapa = tinta(context.getImageData(0, 0, ancho, alto));

  // La franja de tinta que pasa por el medio de la zona: lo que asome arriba
  // (el QR) o abajo (un texto) queda afuera.
  const conTinta = mapa.map((fila) => fila.some(Boolean));
  let medio = Math.round(alto / 2);
  if (!conTinta[medio]) {
    const cerca = conTinta.findIndex((v, i) => v && Math.abs(i - medio) < margen * escala);
    if (cerca === -1) return null;
    medio = cerca;
  }
  let arriba = medio;
  while (arriba > 0 && conTinta[arriba - 1]) arriba--;
  let abajo = medio;
  while (abajo < alto - 1 && conTinta[abajo + 1]) abajo++;
  const franja = mapa.slice(arriba, abajo + 1);

  const columnas = Array.from({ length: ancho }, (_, x) => franja.some((fila) => fila[x]));
  const izquierda = columnas.indexOf(true);
  const derecha = columnas.lastIndexOf(true);
  if (izquierda === -1) return null;
  let finPrimera = izquierda;
  while (finPrimera + 1 <= derecha && columnas[finPrimera + 1]) finPrimera++;

  const cero = recortar(franja.map((fila) => fila.slice(izquierda, finPrimera + 1)));
  if (!cero) return null;

  const pxAMm = 25.4 / 72 / escala;
  const altoCeroMm = cero.alto * pxAMm;
  const font = await reconocerTipografia(cero.mapa);
  const fuente = FUENTES_NUMERO[font ?? "noto"];

  const sizeMm = altoCeroMm / fuente.alto0;

  // Espacio entre cifras: la segunda cifra también es un "0", así que de
  // borde izquierdo a borde izquierdo tiene que haber justo lo que ocupa una
  // cifra. Lo que sobre o falte es lo que la imprenta las separó o juntó.
  let inicioSegunda = finPrimera + 1;
  while (inicioSegunda <= derecha && !columnas[inicioSegunda]) inicioSegunda++;
  const espaciado =
    inicioSegunda <= derecha && font ? (inicioSegunda - izquierda) * pxAMm - fuente.avance0 * sizeMm : 0;

  const centesimo = (v: number) => Math.round(v * 100) / 100;
  return {
    xMm: centesimo((region.x * escala + (izquierda + derecha + 1) / 2) * pxAMm),
    yMm: centesimo((region.y * escala + arriba + cero.arriba) * pxAMm),
    sizeMm: centesimo(sizeMm),
    // Una diferencia de pocos centésimos es solo el redondeo de los píxeles.
    spacingMm: Math.abs(espaciado) < 0.02 ? 0 : centesimo(espaciado),
    ...(font ? { font } : {}),
  };
}

/** Píxeles con tinta oscura (el número es negro). */
function tinta(imagen: ImageData): Mapa {
  const { data, width, height } = imagen;
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      const i = (y * width + x) * 4;
      return data[i] < 128 && data[i + 1] < 128 && data[i + 2] < 128;
    }),
  );
}

/** Lo recorta a la tinta. Devuelve además cuántas filas sacó de arriba. */
function recortar(mapa: Mapa): { mapa: Mapa; arriba: number; alto: number } | null {
  const filas = mapa.map((fila) => fila.some(Boolean));
  const arriba = filas.indexOf(true);
  const abajo = filas.lastIndexOf(true);
  if (arriba === -1) return null;
  const ancho = mapa[0]?.length ?? 0;
  const cols = Array.from({ length: ancho }, (_, x) => mapa.some((fila) => fila[x]));
  const izq = cols.indexOf(true);
  const der = cols.lastIndexOf(true);
  const recorte = mapa.slice(arriba, abajo + 1).map((fila) => fila.slice(izq, der + 1));
  return { mapa: recorte, arriba, alto: abajo - arriba + 1 };
}

/** Lleva un mapa a un alto fijo, manteniendo la proporción. */
function aAlto(mapa: Mapa, alto: number): Mapa {
  const h = mapa.length;
  const w = mapa[0].length;
  const ancho = Math.max(1, Math.round((w * alto) / h));
  return Array.from({ length: alto }, (_, y) =>
    Array.from({ length: ancho }, (_, x) => mapa[Math.min(h - 1, Math.floor((y * h) / alto))][Math.min(w - 1, Math.floor((x * w) / ancho))]),
  );
}

/** Cuánto se superponen dos formas (1 = idénticas). */
function parecido(a: Mapa, b: Mapa): number {
  const A = aAlto(a, 64);
  const B = aAlto(b, 64);
  const ancho = Math.max(A[0].length, B[0].length);
  let comun = 0;
  let total = 0;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < ancho; x++) {
      const p = A[y][x] ?? false;
      const q = B[y][x] ?? false;
      if (p && q) comun++;
      if (p || q) total++;
    }
  }
  return total ? comun / total : 0;
}

const ceros = new Map<FuenteNumero, Promise<Mapa | null>>();

/** El "0" de una de nuestras tipografías, dibujado en el navegador. */
function ceroDe(fuente: FuenteNumero): Promise<Mapa | null> {
  let listo = ceros.get(fuente);
  if (!listo) {
    listo = (async () => {
      const familia = `toqa-numero-${fuente}`;
      const cara = new FontFace(familia, `url(/api/placa/fuente/${fuente})`);
      await cara.load();
      document.fonts.add(cara);
      const canvas = document.createElement("canvas");
      canvas.width = 300;
      canvas.height = 300;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return null;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, 300, 300);
      context.fillStyle = "#000000";
      context.font = `200px "${familia}"`;
      context.fillText("0", 40, 240);
      return recortar(tinta(context.getImageData(0, 0, 300, 300)))?.mapa ?? null;
    })().catch(() => null);
    ceros.set(fuente, listo);
  }
  return listo;
}

/**
 * Compara el "0" de la plantilla con el de cada tipografía y devuelve la que
 * coincide. Si ninguna se parece lo suficiente (un diseño de Canva con otra
 * letra), no elige: queda la que ya tenía el diseño.
 */
async function reconocerTipografia(cero: Mapa): Promise<FuenteNumero | null> {
  let mejor: { fuente: FuenteNumero; valor: number } | null = null;
  for (const fuente of Object.keys(FUENTES_NUMERO) as FuenteNumero[]) {
    const referencia = await ceroDe(fuente);
    if (!referencia) continue;
    const valor = parecido(cero, referencia);
    if (!mejor || valor > mejor.valor) mejor = { fuente, valor };
  }
  return mejor && mejor.valor >= 0.8 ? mejor.fuente : null;
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
