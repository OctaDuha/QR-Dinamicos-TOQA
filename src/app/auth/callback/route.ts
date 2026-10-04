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
    return volverAlLogin(url, "canje del codigo", error.code, error.message);
  }

  return volverAlLogin(
    url,
    "respuesta de Supabase",
    url.searchParams.get("error_code") ?? url.searchParams.get("error"),
    url.searchParams.get("error_description") ?? (url.search ? null : "volvio sin codigo ni error"),
  );
}

/**
 * Vuelve al login con el aviso para la persona y, en letra chica, el motivo
 * tecnico tal cual lo mando Supabase. Sin ese detalle, "no se pudo entrar"
 * no dice si fallo el secreto de Google, la direccion de vuelta o la
 * invitacion; con el, se sabe al primer intento. No tiene nada sensible.
 */
function volverAlLogin(url: URL, etapa: string, codigo: string | null | undefined, texto: string | null | undefined) {
  const detalle = [codigo, texto].filter(Boolean).join(": ").slice(0, 160);
  console.error(`[auth/callback] fallo en ${etapa}: ${detalle || "(sin detalle)"}`);

  const destino = new URL("/login", url.origin);
  destino.searchParams.set("error", motivo(codigo, texto));
  if (detalle) destino.searchParams.set("detalle", detalle);
  return NextResponse.redirect(destino);
}

/**
 * Por que no se pudo entrar. Con el registro apagado, Supabase dice "signups
 * not allowed"; con la lista de invitados, la base rechaza la cuenta nueva y
 * Supabase solo dice "database error saving new user", sin el motivo. Las dos
 * cosas significan lo mismo para quien esta del otro lado: no esta invitado.
 */
function motivo(...textos: (string | null | undefined)[]): "sin-acceso" | "google" {
  const texto = textos.filter(Boolean).join(" ").toLowerCase();
  return /signup|sign up|not allowed|database error saving new user/.test(texto) ? "sin-acceso" : "google";
}
