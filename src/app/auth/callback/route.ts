import { NextResponse, type NextRequest } from "next/server";

import { destinoSeguro } from "@/lib/destino-seguro";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * La vuelta desde Google.
 *
 * Si salio bien, Supabase manda un codigo que se canjea por la sesion (con la
 * mitad secreta que quedo en una cookie al salir). Si no, manda el motivo:
 * el mas comun es que ese Gmail no esta en la lista de usuarios y el
 * registro esta apagado, que es justamente lo que tiene que pasar.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = destinoSeguro(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    return NextResponse.redirect(new URL(`/login?error=${motivo(error.code, error.message)}`, url.origin));
  }

  return NextResponse.redirect(
    new URL(
      `/login?error=${motivo(
        url.searchParams.get("error_code"),
        url.searchParams.get("error_description"),
        url.searchParams.get("error"),
      )}`,
      url.origin,
    ),
  );
}

function motivo(...textos: (string | null | undefined)[]): "sin-acceso" | "google" {
  const texto = textos.filter(Boolean).join(" ").toLowerCase();
  return /signup|sign up|signups not allowed|not allowed/.test(texto) ? "sin-acceso" : "google";
}
