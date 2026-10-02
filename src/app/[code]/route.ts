import { type NextRequest } from "next/server";

import { canalDe, redirigirQr } from "@/lib/redirect-qr";

// Camino corto de antes: /0001 en el QR y /0001?n en el chip. Las placas
// nuevas llevan /qr/0001 y /nfc/0001, pero este se mantiene para siempre
// por si quedo alguna impresa o grabada con esta forma.
//
// Las rutas estaticas (/login, /dashboard, /api, /qr, /nfc) tienen
// prioridad sobre este segmento dinamico, asi que no les pisa nada.
// Cualquier cosa que no sea un numero cae en la pagina de siempre.
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  return redirigirQr(code, request.headers.get("user-agent"), canalDe(new URL(request.url)));
}
