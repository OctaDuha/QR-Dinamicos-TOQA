import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { CanvaPanel } from "./CanvaPanel";

export const dynamic = "force-dynamic";

export default async function CanvaPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const { msg } = await searchParams;

  const supabase = await createClient();
  const { data: connection } = await supabase
    .from("canva_connections")
    .select("updated_at, scopes")
    .eq("id", 1)
    .maybeSingle();

  const hasCredentials = Boolean(process.env.CANVA_CLIENT_ID && process.env.CANVA_CLIENT_SECRET);
  const connected = Boolean(connection);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Canva</h1>
        <p className="mt-1 text-sm text-ink-2">
          Generación de diseños con la Canva Connect API. Requiere un plan Enterprise.
        </p>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold">Con plan Business esto no está disponible</h2>
        <p className="mt-2 text-sm text-ink-2">
          La API de <em>brand templates</em> funciona en Pro y Business, pero el{" "}
          <strong>autofill</strong> —el paso que rellena el campo <code>qr_code</code> y genera el
          diseño— es exclusivo de <strong>Canva Enterprise</strong>. Con Canva Negocios la API
          responde 403 al intentar el lote.
        </p>
        <p className="mt-2 text-sm text-ink-2">
          Por eso la generación de placas vive en{" "}
          <Link href="/dashboard/placa" className="underline" style={{ color: "var(--accent)" }}>
            Placas para imprenta
          </Link>
          : usa tu mismo diseño de Canva como fondo y estampa el QR por código, sin límite de plan.
          Esta pantalla queda lista por si algún día pasás a Enterprise.
        </p>
      </div>

      {msg ? (
        <p
          className="rounded-lg px-3 py-2 text-sm"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          {msg}
        </p>
      ) : null}

      {!hasCredentials ? (
        <div className="card p-5">
          <h2 className="text-sm font-semibold">Falta configurar la integración</h2>
          <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-sm text-ink-2">
            <li>
              Entrá a{" "}
              <a
                href="https://www.canva.com/developers/"
                target="_blank"
                rel="noreferrer noopener"
                className="underline"
              >
                developers.canva.com
              </a>{" "}
              y creá una integración privada.
            </li>
            <li>
              En <strong>Authentication</strong> agregá la URL de retorno:{" "}
              <code className="text-xs">{`{tu dominio}/api/canva/callback`}</code>
            </li>
            <li>
              En <strong>Scopes</strong> habilitá: <code className="text-xs">asset:read</code>,{" "}
              <code className="text-xs">asset:write</code>,{" "}
              <code className="text-xs">brandtemplate:meta:read</code>,{" "}
              <code className="text-xs">brandtemplate:content:read</code>,{" "}
              <code className="text-xs">design:content:read</code>,{" "}
              <code className="text-xs">design:content:write</code>,{" "}
              <code className="text-xs">design:meta:read</code>.
            </li>
            <li>
              Cargá <code className="text-xs">CANVA_CLIENT_ID</code> y{" "}
              <code className="text-xs">CANVA_CLIENT_SECRET</code> en las variables de entorno (Vercel
              · Settings · Environment Variables) y volvé a desplegar.
            </li>
          </ol>
          <p className="mt-3 text-xs text-ink-3">
            Es una integración distinta de la conexión personal de Canva: esta la usa el sitio, no tu
            usuario.
          </p>
        </div>
      ) : !connected ? (
        <div className="card flex flex-col items-start gap-3 p-5">
          <h2 className="text-sm font-semibold">Conectar la cuenta de Canva</h2>
          <p className="text-sm text-ink-2">
            Una sola vez: autorizás el acceso y el sitio guarda el token para generar los lotes.
          </p>
          <a className="btn btn-primary" href="/api/canva/auth">
            Conectar con Canva
          </a>
        </div>
      ) : (
        <>
          <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm">
              <span className="chip" style={{ color: "var(--good)" }}>
                Conectado
              </span>{" "}
              <span className="text-ink-3">
                desde {new Date(connection!.updated_at as string).toLocaleString("es-AR")}
              </span>
            </p>
            <form action="/api/canva/disconnect" method="post">
              <button type="submit" className="btn btn-ghost text-xs">
                Desconectar
              </button>
            </form>
          </div>

          <CanvaPanel defaultTemplateId={process.env.CANVA_BRAND_TEMPLATE_ID ?? ""} />
        </>
      )}

    </div>
  );
}
