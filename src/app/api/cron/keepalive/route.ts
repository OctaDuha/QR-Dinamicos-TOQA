import { NextResponse, type NextRequest } from "next/server";

import { publicConfig, publicKeyHeaders, resolveQr } from "@/lib/supabase/public-key";

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
    await resolveQr(config, 0, "toqa-keepalive", "qr", 8000);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: (error as Error).message, ms: Date.now() - desde },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const papelera = await vaciarPapelera(config);

  return NextResponse.json(
    { ok: true, ms: Date.now() - desde, papelera },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * De paso, elimina para siempre lo que lleva más de 30 días en la papelera.
 * La función solo hace eso, así que se puede llamar sin usuario. Si falla
 * (o todavía no se corrió 2026-10-papelera.sql) no afecta al keepalive:
 * se vuelve a intentar mañana, y lo vencido igual no se muestra.
 */
async function vaciarPapelera(config: { url: string; key: string }): Promise<number | string> {
  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/vaciar_papelera`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...publicKeyHeaders(config.key) },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return `supabase ${response.status}`;
    return Number(await response.json()) || 0;
  } catch (error) {
    return (error as Error).message;
  }
}
