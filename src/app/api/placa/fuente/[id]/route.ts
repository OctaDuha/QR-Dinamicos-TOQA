import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { FUENTES_NUMERO, esFuenteNumero } from "@/lib/fuentes-numero";

export const runtime = "nodejs";

/**
 * El archivo de una de las tipografías del número. Lo pide la detección del
 * navegador para comparar el número de ejemplo de una plantilla con cada
 * tipografía y quedarse con la que coincide. Son tipografías libres, así que
 * no hace falta sesión.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!esFuenteNumero(id)) return new NextResponse("Tipografía desconocida", { status: 404 });

  const { archivo } = FUENTES_NUMERO[id];
  const datos = await readFile(join(process.cwd(), "src/assets/fuentes", archivo));
  return new NextResponse(new Uint8Array(datos), {
    headers: {
      "Content-Type": archivo.endsWith(".ttf") ? "font/ttf" : "font/woff",
      "Cache-Control": "public, max-age=604800",
    },
  });
}
