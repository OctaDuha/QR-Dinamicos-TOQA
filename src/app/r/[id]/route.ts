import { NextResponse, type NextRequest } from "next/server";

import { parseQrId } from "@/lib/qr";

// Ruta caliente: la persona esta parada con el celular esperando.
// Sin sesion, sin SDK, una sola llamada a Postgres que registra el scan
// y devuelve el destino en la misma ida y vuelta.
export const runtime = "edge";
export const dynamic = "force-dynamic";

const NOT_FOUND_HTML = `<!doctype html>
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

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const id = parseQrId(rawId);

  if (id === null) {
    return notFound();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return new NextResponse("Servicio no configurado", { status: 503 });
  }

  let destination: string | null = null;

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/resolve_qr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...publicKeyHeaders(anonKey),
      },
      body: JSON.stringify({
        p_id: id,
        p_user_agent: request.headers.get("user-agent") ?? null,
      }),
      cache: "no-store",
    });

    if (response.ok) {
      const value: unknown = await response.json();
      if (typeof value === "string" && value.length > 0) {
        destination = value;
      }
    }
  } catch {
    // Se cae al 404 amable de abajo en vez de romper con un 500.
  }

  if (!destination) {
    return notFound();
  }

  return NextResponse.redirect(destination, {
    status: 302,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

/**
 * Supabase tiene dos formatos de clave publica y se mandan distinto.
 *
 * La vieja es un JWT (empieza con "eyJ") y va en los dos headers. La nueva
 * (sb_publishable_...) va SOLO en `apikey`: si va tambien como Bearer, la
 * plataforma intenta leerla como JWT y rechaza la llamada. Distinguirlas por
 * el prefijo evita depender de la compatibilidad hacia atras.
 */
function publicKeyHeaders(key: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: key };
  if (key.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

function notFound() {
  return new NextResponse(NOT_FOUND_HTML, {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
