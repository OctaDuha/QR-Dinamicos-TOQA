import { type NextRequest } from "next/server";

import { redirigirQr } from "@/lib/redirect-qr";

// El camino que va grabado en el chip. Todo lo que entra por aca es un
// toque, y se cuenta aparte de los escaneos del QR de la misma placa.
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  return redirigirQr(code, request.headers.get("user-agent"), "nfc");
}
