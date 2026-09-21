import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export type Rol = "dueno" | "empleado";

export type Sesion = {
  supabase: SupabaseClient;
  userId: string;
  email: string | null;
  rol: Rol;
};

/**
 * Quien esta usando el panel y con que permisos.
 *
 * El rol se guarda en public.perfiles y quien manda de verdad son las
 * politicas de la base: aunque alguien saltee la pantalla, Postgres le
 * rechaza el borrado igual. Lo que hay aca sirve para dos cosas: no mostrar
 * botones que no van a funcionar, y dar un mensaje claro en vez de un
 * silencioso "no se borro nada".
 */
export async function sesionActual(): Promise<Sesion | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle<{ rol: string }>();

  return {
    supabase,
    userId: user.id,
    email: user.email ?? null,
    // Sin perfil cargado se asume el permiso mas bajo. Es lo que pasa si
    // todavia no se corrio la migracion de roles: el panel sigue andando y
    // solo se esconden los botones de borrar.
    rol: data?.rol === "dueno" ? "dueno" : "empleado",
  };
}

export async function esDueno(): Promise<boolean> {
  return (await sesionActual())?.rol === "dueno";
}

type Guardia =
  | { sesion: Sesion; denied: null }
  | { sesion: null; denied: NextResponse };

/** Para las rutas que sólo puede usar el dueño: borrar. */
export async function requireDueno(): Promise<Guardia> {
  const sesion = await sesionActual();

  if (!sesion) {
    return { sesion: null, denied: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  if (sesion.rol !== "dueno") {
    return {
      sesion: null,
      denied: NextResponse.json(
        { error: "Sólo el dueño puede borrar. Pedíselo a quien administre la cuenta." },
        { status: 403 },
      ),
    };
  }

  return { sesion, denied: null };
}
