import { NextResponse } from "next/server";

import { publicConfig, resolveQr } from "@/lib/supabase/public-key";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * Estado del servicio para un monitor externo gratuito (UptimeRobot y
 * similares). Recorre el mismo camino que un escaneo real, asi que si esto
 * responde 200 las placas funcionan. Devuelve 503 cuando no, para que el
 * monitor avise por mail antes de que se queje un cliente.
 *
 * No expone nada privado: ni claves, ni destinos, ni numeros de QR.
 */
export async function GET() {
  const config = publicConfig();
  if (!config) {
    return estado({ ok: false, base: "sin configurar" }, 503);
  }

  const desde = Date.now();
  try {
    await resolveQr(config, 0, "toqa-health", 5000);
    return estado({ ok: true, base: "ok", ms: Date.now() - desde }, 200);
  } catch (error) {
    return estado(
      { ok: false, base: "no responde", detalle: (error as Error).message, ms: Date.now() - desde },
      503,
    );
  }
}

function estado(cuerpo: Record<string, unknown>, status: number) {
  return NextResponse.json(cuerpo, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
