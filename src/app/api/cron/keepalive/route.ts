import { NextResponse, type NextRequest } from "next/server";

import { publicConfig, resolveQr } from "@/lib/supabase/public-key";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * Supabase pausa los proyectos gratuitos que pasan varios dias sin recibir
 * consultas, y una base pausada deja muertas todas las placas impresas hasta
 * que alguien la despierta a mano. Vercel llama a esta ruta una vez por dia
 * para que eso no pase nunca.
 *
 * Usa el id 0, que no existe: resolve_qr corre igual contra Postgres (la
 * base cuenta la actividad) pero devuelve null y no registra ningun escaneo,
 * asi que no ensucia las estadisticas.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "no autorizado" }, { status: 401 });
  }

  const config = publicConfig();
  if (!config) {
    return NextResponse.json({ ok: false, error: "Supabase sin configurar" }, { status: 503 });
  }

  const desde = Date.now();
  try {
    await resolveQr(config, 0, "toqa-keepalive", 8000);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: (error as Error).message, ms: Date.now() - desde },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { ok: true, ms: Date.now() - desde },
    { headers: { "Cache-Control": "no-store" } },
  );
}
