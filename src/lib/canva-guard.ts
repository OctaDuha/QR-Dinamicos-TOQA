import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type AdminResult =
  | { supabase: SupabaseClient; denied: null }
  | { supabase: null; denied: NextResponse };

/** Todas las rutas de Canva son de administrador. */
export async function requireAdmin(): Promise<AdminResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase: null, denied: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  return { supabase, denied: null };
}
