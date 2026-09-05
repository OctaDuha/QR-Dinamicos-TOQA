import { NextResponse, type NextRequest } from "next/server";

import { parseQrId } from "@/lib/qr";
import { publicConfig, resolveQr } from "@/lib/supabase/public-key";

// Ruta caliente: la persona esta parada con el celular esperando.
// Sin sesion, sin SDK, una sola llamada a Postgres que registra el scan
// y devuelve el destino en la misma ida y vuelta.
export const runtime = "edge";
export const dynamic = "force-dynamic";

const SIN_DESTINO_HTML = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>QR sin destino</title>
<style>
  :root{color-scheme:light dark}
  body{margin:0;min-height:100vh;display:grid;place-items:center;
       font:16px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
       background:#f4f3f0;color:#0b0b0b;padding:24px;text-align:center}
  @media (prefers-color-scheme:dark){body{background:#121211;color:#fff}}
  h1{font-size:1.15rem;margin:0 0 .5rem}
  p{margin:0;opacity:.7;font-size:.9rem}
</style></head>
<body><div><h1>Este QR todavía no tiene destino</h1>
<p>Si sos el dueño de la placa, configuralo desde el panel.</p></div></body></html>`;

/**
 * A donde mandar a la persona cuando no pudimos resolver el QR: la base no
 * contesta, o el numero no existe. Es la red de seguridad de toda placa ya
 * impresa, asi que si esta configurada gana siempre por sobre la pagina de
 * error: mas vale caer en el Instagram de TOQA que en un error del navegador.
 */
function fallbackUrl(): string | null {
  const raw = process.env.QR_FALLBACK_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const id = parseQrId(rawId);
  const config = publicConfig();

  if (id === null || !config) {
    return sinDestino();
  }

  const userAgent = request.headers.get("user-agent") ?? null;

  // Dos intentos: un corte de red o un 5xx pasajero de Supabase no puede
  // costarnos un escaneo. El segundo intento no reintenta un "no existe":
  // resolveQr solo lanza cuando la base no contesta.
  //
  // La excepcion es el timeout: si la base ya se colgo una vez, reintentar
  // solo suma otra espera igual de larga, y del otro lado hay alguien parado
  // con el celular. Ahi vamos derecho al respaldo.
  for (let intento = 0; intento < 2; intento += 1) {
    try {
      const destination = await resolveQr(config, id, userAgent);
      return destination ? redirigir(destination) : sinDestino();
    } catch (error) {
      if (intento === 0 && !esTimeout(error)) continue;
      break;
    }
  }

  return sinDestino();
}

function esTimeout(error: unknown): boolean {
  const nombre = (error as { name?: string } | null)?.name;
  return nombre === "TimeoutError" || nombre === "AbortError";
}

function redirigir(destination: string) {
  return NextResponse.redirect(destination, {
    status: 302,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

/**
 * Nunca devolvemos un error de navegador a alguien que escaneo una placa:
 * o lo mandamos al destino de respaldo, o le mostramos una pagina explicando
 * que pasa. El 404 sin respaldo se mantiene para que un monitor externo lo
 * pueda detectar.
 */
function sinDestino() {
  const respaldo = fallbackUrl();
  if (respaldo) return redirigir(respaldo);

  return new NextResponse(SIN_DESTINO_HTML, {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
