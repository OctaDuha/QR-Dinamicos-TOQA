import { FUENTE_POR_DEFECTO, esFuenteNumero, type FuenteNumero } from "./fuentes-numero";

/**
 * La posicion del QR y del numero dentro de cada diseno. Vive aparte de
 * placa.ts para poder usarse en el navegador (el estudio de placas) sin
 * arrastrar pdf-lib ni la lectura de tipografias del disco.
 */

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
  /**
   * Espacio de más (o de menos, si es negativo) entre cifra y cifra, en mm.
   * La imprenta a veces junta las letras; se copia del número de ejemplo.
   */
  numberSpacingMm: number;
  /**
   * Solo disenos cuadrados (vinilos circulares): diametro del circulo de color
   * dibujado en el diseno, hasta el borde de afuera del aro, en mm. Se mide al
   * cargar el diseno y sirve para llevarlo al tamano justo; null = sin medir.
   */
  circuloMm: number | null;
  /** Tipografía del número. En las plantillas de imprenta se elige sola. */
  numberFont: FuenteNumero;
  /**
   * Solo plantillas de imprenta (PDF con marcas de corte y caja de corte,
   * TrimBox): la pieza terminada, en mm desde arriba a la izquierda de la
   * hoja. Esas plantillas salen tal cual, sin achicar ni agregar márgenes ni
   * línea de corte propia. Lo calcula el servidor leyendo el PDF; acá sirve
   * para que la pantalla muestre la pieza cortada. null = diseño común.
   */
  imprenta: Imprenta | null;
};

export type Imprenta = { xMm: number; yMm: number; anchoMm: number; altoMm: number };

/** Las plantillas cuadradas son vinilos redondos: el corte es un círculo. */
export function imprentaCircular(imprenta: Imprenta | null | undefined) {
  return Boolean(imprenta && Math.abs(imprenta.anchoMm - imprenta.altoMm) <= 0.5);
}

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
  numberSpacingMm: 0,
  circuloMm: null,
  numberFont: FUENTE_POR_DEFECTO,
  imprenta: null,
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
    numberSpacingMm: num(value.numberSpacingMm, 0, -5, 5),
    circuloMm:
      value.circuloMm == null || !Number.isFinite(Number(value.circuloMm))
        ? null
        : num(value.circuloMm, 0, 10, 500),
    numberFont: esFuenteNumero(value.numberFont) ? value.numberFont : FUENTE_POR_DEFECTO,
    imprenta: normalizarImprenta(value.imprenta),
  };
}

function normalizarImprenta(raw: unknown): Imprenta | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  const n = (k: string) => Number(v[k]);
  const caja = { xMm: n("xMm"), yMm: n("yMm"), anchoMm: n("anchoMm"), altoMm: n("altoMm") };
  const valido =
    Object.values(caja).every(Number.isFinite) && caja.anchoMm > 5 && caja.altoMm > 5 && caja.xMm >= 0 && caja.yMm >= 0;
  return valido ? caja : null;
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
  sample?: { xMm: number; yMm: number; sizeMm: number; spacingMm?: number; font?: FuenteNumero } | null,
): Pick<PlacaLayout, "numberSizeMm" | "numberXMm" | "numberYMm" | "numberSpacingMm"> & { numberFont?: FuenteNumero } {
  const redondo = (v: number) => Math.round(v * 10) / 10;

  // 1) Si el diseno ya trae un numero de ejemplo, el nuestro va justo ahi:
  //    queda donde el diseno lo previo y lo tapa el recuadro blanco.
  if (sample) {
    // Al centésimo: en los vinilos el número mide apenas 1 mm y un décimo ya
    // se notaría al lado del de ejemplo.
    const fino = (v: number) => Math.round(v * 100) / 100;
    return {
      numberSizeMm: fino(sample.sizeMm),
      numberXMm: fino(sample.xMm),
      numberYMm: fino(sample.yMm),
      numberSpacingMm: fino(sample.spacingMm ?? 0),
      // Y con la misma tipografía, si se reconoció.
      ...(sample.font ? { numberFont: sample.font } : {}),
    };
  }

  // 2) Si no, la primera franja blanca debajo del QR.
  // 3) Y si tampoco hay, pegado al QR, para que el usuario lo corra.
  return {
    numberSizeMm: redondo(sizeMm * 0.13),
    numberXMm: redondo(xMm + sizeMm / 2),
    numberYMm:
      freeBandYMm != null ? redondo(freeBandYMm) : redondo(yMm + sizeMm + sizeMm * 0.08),
    numberSpacingMm: 0,
  };
}
