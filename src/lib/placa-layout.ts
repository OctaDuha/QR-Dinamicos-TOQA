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
   * Solo disenos cuadrados (vinilos circulares): diametro del circulo de color
   * dibujado en el diseno, hasta el borde de afuera del aro, en mm. Se mide al
   * cargar el diseno y sirve para llevarlo al tamano justo; null = sin medir.
   */
  circuloMm: number | null;
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
  circuloMm: null,
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
    circuloMm:
      value.circuloMm == null || !Number.isFinite(Number(value.circuloMm))
        ? null
        : num(value.circuloMm, 0, 10, 500),
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
