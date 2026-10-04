"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { destinoSeguro } from "@/lib/destino-seguro";
import { siteUrl } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email || !password) {
    return { error: "Completá email y contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      error:
        error.message === "Invalid login credentials"
          ? "Email o contraseña incorrectos."
          : error.message,
    };
  }

  redirect(destinoSeguro(next));
}

/**
 * Entrar con Google.
 *
 * Google solo confirma de quien es el Gmail; quien puede entrar lo sigue
 * decidiendo la lista de usuarios de Supabase. Con el registro apagado, un
 * Gmail que no esta en la lista vuelve rechazado, y uno que esta pero no fue
 * aprobado entra a la pantalla de "sin acceso".
 *
 * Supabase arma el link a Google y guarda en una cookie la mitad secreta del
 * intercambio; la otra mitad vuelve en /auth/callback. Por eso la vuelta
 * tiene que ser al mismo sitio desde el que se salio: si no, la cookie no
 * esta y el intercambio falla.
 */
export async function loginConGoogle(formData: FormData) {
  const next = destinoSeguro(String(formData.get("next") ?? ""));
  const origen = (await headers()).get("origin") ?? siteUrl();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origen}/auth/callback?next=${encodeURIComponent(next)}`,
      // Que Google siempre pregunte con que cuenta: con varias abiertas en el
      // navegador, si no, entra solo con la que tenga a mano.
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}

export async function logout() {
  const supabase = await createClient();
  // Solo esta sesion. Supabase por defecto cierra todas las del usuario, en
  // todos los navegadores: salir en una ventana de prueba dejaba la otra con
  // la pantalla a la vista pero sin sesion, y cada accion daba "No autorizado".
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
