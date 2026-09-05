import { type NextRequest } from "next/server";

import { redirigirQr } from "@/lib/redirect-qr";

// Camino corto: es el que va impreso en las placas. Sacarle el "/r/" del
// medio deja la direccion en 26 caracteres, y eso baja el QR de 29x29 a
// 25x25 modulos: cuadraditos 16% mas grandes, que se escanean mejor de
// lejos y aguantan mejor una placa rayada o curva.
//
// Las rutas estaticas (/login, /dashboard, /api) tienen prioridad sobre
// este segmento dinamico, asi que no les pisa nada. Cualquier cosa que no
// sea un numero cae en la pagina de siempre.
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  return redirigirQr(code, request.headers.get("user-agent"));
}
