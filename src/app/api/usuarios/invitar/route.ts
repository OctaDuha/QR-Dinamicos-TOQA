import { NextResponse, type NextRequest } from "next/server";

import { requireDueno } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invitar a alguien. Sólo el dueño; la base tampoco deja a nadie más.
 *
 * La invitación es lo único que hace falta: cuando esa persona entra con
 * Google, la base le crea la cuenta con este rol y la invitación se gasta.
 */
export async function POST(request: NextRequest) {
  const { sesion, denied } = await requireDueno();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { email?: string; rol?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const rol = body.rol === "dueno" ? "dueno" : "empleado";

  if (!MAIL.test(email)) {
    return NextResponse.json({ error: "Ese mail no parece válido." }, { status: 400 });
  }

  // Si ya tiene cuenta, invitarlo no cambia nada: el rol se cambia en la lista.
  const { data: existente } = await sesion.supabase
    .from("perfiles")
    .select("id")
    .ilike("email", email)
    .limit(1);
  if ((existente?.length ?? 0) > 0) {
    return NextResponse.json(
      { error: "Ese mail ya tiene cuenta. Cambiale el rol en la lista de arriba." },
      { status: 400 },
    );
  }

  const { error } = await sesion.supabase
    .from("invitaciones")
    .insert({ email, rol, invitado_por: sesion.userId });

  if (error) {
    const yaInvitado = error.code === "23505";
    const sinMigracion = error.code === "42P01" || error.code === "PGRST205";
    return NextResponse.json(
      {
        error: yaInvitado
          ? "Ese mail ya está invitado."
          : sinMigracion
            ? "Falta correr en Supabase el archivo 2026-10-invitaciones.sql."
            : error.message,
      },
      { status: yaInvitado ? 409 : 500 },
    );
  }

  return NextResponse.json({ ok: true, email, rol });
}

/** Cancelar una invitación que todavía no se usó. */
export async function DELETE(request: NextRequest) {
  const { sesion, denied } = await requireDueno();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Falta el mail." }, { status: 400 });

  const { data, error } = await sesion.supabase
    .from("invitaciones")
    .delete()
    .eq("email", email)
    .select("email");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if ((data?.length ?? 0) === 0) {
    return NextResponse.json({ error: "Esa invitación ya no existe: puede que ya la hayan usado." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
