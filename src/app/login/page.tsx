import { destinoSeguro } from "@/lib/destino-seguro";
import { publicConfig, publicKeyHeaders } from "@/lib/supabase/public-key";

import LoginForm from "./LoginForm";

/** Lo que vuelve de /auth/callback cuando entrar con Google no salio. */
const ERRORES: Record<string, string> = {
  "sin-acceso":
    "Esa cuenta de Google no está invitada a este panel. Si deberías entrar, pedile al dueño que te invite.",
  google:
    "No se pudo entrar con Google. Probá de nuevo, o entrá con tu mail y contraseña.",
};

/**
 * ¿Esta activada la entrada con Google en Supabase?
 *
 * El boton se muestra solo si lo esta: antes de terminar la configuracion,
 * tocarlo llevaria a una pagina de error de Supabase. Supabase publica que
 * proveedores tiene activos, y se pregunta cada vez, sin guardar la
 * respuesta: guardada, al activar Google el boton tardaba en aparecer y
 * parecia que algo andaba mal. El login se abre pocas veces; no pesa.
 * Si Supabase no contesta, el boton no aparece y la entrada con mail sigue.
 */
async function googleActivo(): Promise<boolean> {
  const config = publicConfig();
  if (!config) return false;
  try {
    const respuesta = await fetch(`${config.url}/auth/v1/settings`, {
      headers: publicKeyHeaders(config.key),
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!respuesta.ok) return false;
    const ajustes = (await respuesta.json()) as {
      external?: { google?: boolean };
    };
    return ajustes.external?.google === true;
  } catch {
    return false;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; detalle?: string }>;
}) {
  const { next, error, detalle } = await searchParams;
  const target = destinoSeguro(next);
  const conGoogle = await googleActivo();

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <p
            className="text-sm font-bold tracking-[0.22em] uppercase"
            style={{ color: "var(--accent)" }}
          >
            TOQA<span className="numero-placa">.</span>
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
            QR dinámicos
          </h1>
          <p className="mt-1.5 text-sm text-ink-2">Panel de administración</p>
        </div>

        <div className="card p-6">
          <LoginForm
            next={target}
            conGoogle={conGoogle}
            errorInicial={error ? (ERRORES[error] ?? ERRORES.google) : null}
            detalleInicial={error && detalle ? detalle.slice(0, 160) : null}
          />
        </div>

        <p className="mt-5 text-center text-xs text-ink-3">
          Para entrar, el dueño del panel te tiene que invitar.{" "}
          <a href="/privacidad" className="underline">
            Privacidad
          </a>
        </p>
      </div>
    </main>
  );
}
