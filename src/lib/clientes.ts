import { parseQrId } from "./qr";

export type Cliente = {
  id: number;
  nombre: string;
  contacto: string | null;
  notas: string | null;
  creado_en: string;
};

/**
 * Lleva un teléfono a como lo informa WhatsApp: solo números, con el código
 * de país. Pensado para Argentina, que es lo que se escribe casi siempre:
 *   "11 15 1234-5678", "011 1234 5678", "+54 9 11 1234-5678" -> 5491112345678
 * Un número de otro país se acepta si viene con "+" y su código.
 * Devuelve null si no parece un teléfono.
 */
export function normalizarTelefono(texto: string): string | null {
  const conMas = texto.trim().startsWith("+");
  let d = texto.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);

  if (d.startsWith("54") && (conMas || d.length >= 12)) {
    let nacional = d.slice(2);
    if (nacional.startsWith("9")) nacional = nacional.slice(1);
    nacional = sinCeroNi15(nacional);
    return esNacional(nacional) ? `549${nacional}` : null;
  }

  if (conMas) return d.length >= 8 && d.length <= 15 ? d : null;

  const nacional = sinCeroNi15(d);
  return esNacional(nacional) ? `549${nacional}` : null;
}

/**
 * Diez cifras con código de área. Los códigos argentinos empiezan con 11, 2
 * o 3: así un número escrito sin código ("15 1234-5678") se rechaza en vez
 * de guardarse mal.
 */
function esNacional(numero: string): boolean {
  return /^(11|[23])\d{8,9}$/.test(numero) && numero.length === 10;
}

/** Saca el 0 de larga distancia y el 15 de celular, que WhatsApp no usa. */
function sinCeroNi15(numero: string): string {
  let n = numero.replace(/^0+/, "");
  if (n.length === 12) {
    // El 15 va después del código de área, que tiene 2, 3 o 4 cifras.
    for (const area of [2, 3, 4]) {
      if (n.slice(area, area + 2) === "15") {
        n = n.slice(0, area) + n.slice(area + 2);
        break;
      }
    }
  }
  return n;
}

/**
 * 5491112345678 -> "+54 9 11 1234-5678". Fuera de Buenos Aires el código de
 * área puede tener 3 o 4 cifras y no se sabe dónde cortar: va de corrido.
 */
export function mostrarTelefono(telefono: string): string {
  if (/^54911\d{8}$/.test(telefono)) return `+54 9 11 ${telefono.slice(5, 9)}-${telefono.slice(9)}`;
  if (telefono.startsWith("549")) return `+54 9 ${telefono.slice(3)}`;
  return `+${telefono}`;
}

/** Lee los teléfonos de un cuadro de texto: uno por renglón, o separados por coma. */
export function leerTelefonos(texto: string): { telefonos: string[]; malos: string[] } {
  const telefonos = new Set<string>();
  const malos: string[] = [];
  for (const parte of texto.split(/[\n,;]+/)) {
    if (!parte.trim()) continue;
    const telefono = normalizarTelefono(parte);
    if (telefono) telefonos.add(telefono);
    else malos.push(parte.trim());
  }
  return { telefonos: [...telefonos], malos };
}

/** "41, 43-45, 0050" -> [41, 43, 44, 45, 50]. Hasta 1000 números. */
export function leerNumerosDePlacas(texto: string): { ids: number[]; malos: string[] } {
  const ids = new Set<number>();
  const malos: string[] = [];
  for (const parte of texto.split(/[\s,;]+/)) {
    if (!parte) continue;
    const rango = parte.match(/^#?(\d+)-#?(\d+)$/);
    if (rango) {
      const desde = parseQrId(rango[1]);
      const hasta = parseQrId(rango[2]);
      if (desde === null || hasta === null || hasta < desde || hasta - desde >= 1000) {
        malos.push(parte);
        continue;
      }
      for (let id = desde; id <= hasta; id++) ids.add(id);
      continue;
    }
    const id = parseQrId(parte.replace(/^#/, ""));
    if (id === null) malos.push(parte);
    else ids.add(id);
  }
  return { ids: [...ids].sort((a, b) => a - b).slice(0, 1000), malos };
}

/**
 * Sin la migración 2026-10-clientes.sql no existen la tabla ni la columna:
 * las pantallas lo avisan en vez de romper.
 */
export function faltaMigracionClientes(error: { code?: string } | null): boolean {
  return Boolean(error && ["42P01", "42703", "PGRST200", "PGRST204", "PGRST205"].includes(error.code ?? ""));
}

export const AVISO_MIGRACION_CLIENTES =
  "Para usar Clientes falta correr en Supabase el archivo 2026-10-clientes.sql.";
