import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { sesionActual } from "@/lib/roles";

type AdminResult =
  | { supabase: SupabaseClient; denied: null }
  | { supabase: null; denied: NextResponse };

/**
 * Las rutas del panel: hace falta una cuenta aprobada.
 *
 * Que la cuenta este logueada no alcanza. La base ya le niega todo a una
 * cuenta pendiente, pero varias de estas rutas leen cosas que no viven en la
 * base —el respaldo, los mails, Canva—, y esas no pasan por sus politicas.
 */
export async function requireAdmin(): Promise<AdminResult> {
  const sesion = await sesionActual();

  if (!sesion) {
    return { supabase: null, denied: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  if (sesion.rol === "pendiente") {
    return {
      supabase: null,
      denied: NextResponse.json(
        { error: "Tu cuenta todavía no fue aprobada. Pedíselo al dueño del panel." },
        { status: 403 },
      ),
    };
  }

  return { supabase: sesion.supabase, denied: null };
}
