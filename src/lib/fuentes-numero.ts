/**
 * Las tipografías con que se puede dibujar el número de la placa. Vive aparte
 * para que la use también el navegador (la detección elige la que coincide
 * con el número de ejemplo de la plantilla) sin leer nada del disco.
 *
 * El número siempre sale en curvas, nunca como texto: las máquinas de la
 * imprenta no reconocen tipografías. Los archivos están en src/assets/fuentes
 * y son de licencia libre (SIL OFL), por eso se pueden usar y distribuir.
 */

export const FUENTES_NUMERO = {
  /** La de siempre, para los diseños de Canva. */
  noto: { nombre: "Noto Sans Bold", archivo: "noto-sans-700.woff", alto0: 0.735, tope0: 0.725, avance0: 0.572 },
  /**
   * La imprenta escribió el número de los vinilos redondos en Calibri Bold,
   * que es de Microsoft y no se puede distribuir. Carlito es su copia libre:
   * mismas formas y mismas medidas, hecha justamente para reemplazarla.
   */
  calibri: { nombre: "Calibri Bold", archivo: "carlito-700.ttf", alto0: 0.6626, tope0: 0.6558, avance0: 0.5068 },
  /** La de las placas rectangulares de la imprenta. */
  lato: { nombre: "Lato Semibold", archivo: "lato-600.woff", alto0: 0.7355, tope0: 0.728, avance0: 0.58 },
} as const;

/*
 * alto0 y tope0 son el alto del "0" y su borde de arriba sobre la línea de
 * base, en fracción del cuerpo de la letra. avance0 es lo que ocupa cada
 * cifra (en las tres, todas las cifras ocupan lo mismo). Se usan para que el
 * número real caiga exactamente sobre el de ejemplo: la detección mide el "0"
 * de la plantilla y de ahí saca el cuerpo con que hay que dibujarlo, y la
 * distancia entre los dos primeros ceros le da el espacio entre cifras.
 */

export type FuenteNumero = keyof typeof FUENTES_NUMERO;

export const FUENTE_POR_DEFECTO: FuenteNumero = "noto";

export function esFuenteNumero(valor: unknown): valor is FuenteNumero {
  return typeof valor === "string" && Object.hasOwn(FUENTES_NUMERO, valor);
}
