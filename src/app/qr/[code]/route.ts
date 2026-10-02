import { type NextRequest } from "next/server";

import { redirigirQr } from "@/lib/redirect-qr";

// El camino que va impreso en el QR. El canal lo dice la direccion misma:
// todo lo que entra por aca es un escaneo, venga con lo que venga detras.
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  return redirigirQr(code, request.headers.get("user-agent"), "qr");
}
