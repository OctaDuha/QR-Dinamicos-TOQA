import { type NextRequest } from "next/server";

import { redirigirQr } from "@/lib/redirect-qr";

// Camino viejo. Las placas nuevas se imprimen con el corto (/0001), pero
// esta ruta se mantiene para siempre: puede haber placas impresas con esta
// forma, y una placa impresa no se corrige.
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return redirigirQr(id, request.headers.get("user-agent"));
}
